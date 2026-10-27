import { ApiError, apiJson } from '../../lib/api';
import type { ReservationInput } from '../../../../../packages/contracts/src/index';
import type { Song } from '../search/api';

export async function reserve(song: Song | null, singer: string, comment: string, secret = false, keychange = 0): Promise<{ id: number; warnings: string[] }> {
  const form: ReservationInput = {
    filename: song?.name ?? '小休止',
    fullpath: song?.fullpath ?? '',
    singer: singer.trim(),
    comment,
    kind: song ? '動画' : '小休止',
    keychange,
    ...(secret ? { secret: 1 } : {}),
  };
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(form))))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const key = 'yukari.pendingSubmission.v1';
  const readPending = (): Record<string, string> => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) || 'null');
      // Migrate the previous single-slot format without discarding an uncertain receipt.
      if (stored && typeof stored === 'object' && 'fingerprint' in stored && 'receipt' in stored
        && typeof stored.fingerprint === 'string' && typeof stored.receipt === 'string') {
        return {[stored.fingerprint]: stored.receipt};
      }
      if (stored && typeof stored === 'object' && 'receipts' in stored && stored.receipts
        && typeof stored.receipts === 'object' && !Array.isArray(stored.receipts)) {
        return Object.fromEntries(Object.entries(stored.receipts).filter(([fingerprint, receipt]) =>
          /^[a-f0-9]{64}$/.test(fingerprint) && typeof receipt === 'string' && receipt.length <= 256));
      }
    } catch { /* Ignore corrupt browser state and let the API issue a fresh receipt. */ }
    return {};
  };
  const pending = readPending();
  let receipt = pending[fingerprint];
  if (receipt) {
    const status = await apiJson('/requests/result', { method: 'POST', body: JSON.stringify({receipt}) }) as {state:string;result?:{id?:number;warnings?:unknown[]}};
    if (status.state === 'committed' && typeof status.result?.id === 'number') {
      delete pending[fingerprint];
      localStorage.setItem(key, JSON.stringify({receipts:pending}));
      return { id: status.result.id, warnings: Array.isArray(status.result.warnings) ? status.result.warnings.map(String) : [] };
    }
    // not_found is retried with the exact same receipt and payload. Other fingerprints
    // have independent receipts, so one uncertain request cannot block all bookings.
  } else {
    receipt = String((await apiJson('/requests/intent', {method:'POST',body:'{}'})).receipt);
    pending[fingerprint] = receipt;
    localStorage.setItem(key, JSON.stringify({receipts:pending}));
  }
  const result = await apiJson('/requests', {
    method: 'POST',
    headers: {'X-Yukari-Submission': receipt},
    body: JSON.stringify(form),
  });
  if (typeof result.id !== 'number' || !Number.isSafeInteger(result.id) || result.id <= 0) {
    throw new ApiError('原预约接口未返回有效 newid，未确认预约成功。请先刷新队列。');
  }
  delete pending[fingerprint];
  localStorage.setItem(key, JSON.stringify({receipts:pending}));
  return {id: result.id, warnings: Array.isArray(result.warnings) ? result.warnings.map(String) : []};
}
