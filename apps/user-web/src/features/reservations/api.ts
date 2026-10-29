import { ApiError, apiJson } from '../../lib/api';
import type { ReservationInput } from '../../../../../packages/contracts/src/index';
import type { Song } from '../search/api';

type ReservationResult = { id?: number; warnings?: unknown[] };
type ReceiptStatus = { state: 'committed' | 'not_found'; result?: ReservationResult };
type ConfirmedResult = { id: number; warnings: string[] };

function confirmedResult(status: ReceiptStatus): ConfirmedResult | null {
  const result = status.result;
  return status.state === 'committed' && typeof result?.id === 'number'
    && Number.isSafeInteger(result.id) && result.id > 0
    ? { id: result.id, warnings: Array.isArray(result.warnings) ? result.warnings.map(String) : [] }
    : null;
}

// Preserve the existing SHA-256 browser-storage keys so pending receipts from
// previous builds remain recoverable. HTTP LAN origins may not expose Web
// Crypto's subtle API, so use a small standards-based fallback there.
function sha256Fallback(input: Uint8Array): string {
  const constants = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const state = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const length = Math.ceil((input.length + 9) / 64) * 64;
  const padded = new Uint8Array(length);
  padded.set(input); padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = input.length * 8;
  view.setUint32(length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(length - 4, bitLength >>> 0);
  const rotate = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));
  const words = new Uint32Array(64);
  for (let offset = 0; offset < length; offset += 64) {
    for (let index = 0; index < 16; index++) words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index++) {
      const x = words[index - 15]!, y = words[index - 2]!;
      const s0 = rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3);
      const s1 = rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10);
      words[index] = (words[index - 16]! + s0 + words[index - 7]! + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = state;
    for (let index = 0; index < 64; index++) {
      const s1 = rotate(e!, 6) ^ rotate(e!, 11) ^ rotate(e!, 25);
      const choose = (e! & f!) ^ (~e! & g!);
      const t1 = (h! + s1 + choose + constants[index]! + words[index]!) >>> 0;
      const s0 = rotate(a!, 2) ^ rotate(a!, 13) ^ rotate(a!, 22);
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const t2 = (s0 + majority) >>> 0;
      h=g; g=f; f=e; e=(d!+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    const result = [a,b,c,d,e,f,g,h];
    for (let index = 0; index < 8; index++) state[index] = (state[index]! + result[index]!) >>> 0;
  }
  return Array.from(state, value => value.toString(16).padStart(8, '0')).join('');
}

async function fingerprintInput(value: ReservationInput): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (globalThis.crypto?.subtle) {
    return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(bytes);
}

function markStage(error: unknown, stage: string): ApiError {
  const value = error instanceof ApiError ? error : new ApiError('Network request failed', 0, 'NETWORK_ERROR');
  value.stage = stage;
  return value;
}

async function lookupReceipt(receipt: string): Promise<ReceiptStatus> {
  return await apiJson('/requests/result', { method: 'POST', body: JSON.stringify({ receipt }) }) as ReceiptStatus;
}

function readPending(storageKey: string): Record<string, string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (stored && typeof stored === 'object' && 'fingerprint' in stored && 'receipt' in stored
      && typeof stored.fingerprint === 'string' && typeof stored.receipt === 'string') {
      return { [stored.fingerprint]: stored.receipt };
    }
    if (stored && typeof stored === 'object' && 'receipts' in stored && stored.receipts
      && typeof stored.receipts === 'object' && !Array.isArray(stored.receipts)) {
      return Object.fromEntries(Object.entries(stored.receipts).filter(([fingerprint, receipt]) =>
        /^(?:[a-f0-9]{32}|[a-f0-9]{64})$/.test(fingerprint) && typeof receipt === 'string' && receipt.length <= 256));
    }
  } catch { /* Ignore corrupt browser state; it never authorizes a database write. */ }
  return {};
}

/** Resolve saved uncertain submissions without replaying their reservation POST. */
let pendingRecovery: Promise<ConfirmedResult[]> | null = null;
export function recoverPendingReservations(): Promise<ConfirmedResult[]> {
  if (pendingRecovery) return pendingRecovery;
  const current = resolvePendingReservations();
  pendingRecovery = current;
  void current.then(() => { if (pendingRecovery === current) pendingRecovery = null; }, () => { if (pendingRecovery === current) pendingRecovery = null; });
  return current;
}

async function resolvePendingReservations(): Promise<ConfirmedResult[]> {
  const storageKey = 'yukari.pendingSubmission.v1';
  const pending = readPending(storageKey);
  const recovered: ConfirmedResult[] = [];
  // Bound startup traffic even if browser storage was manually edited.
  for (const [fingerprint, receipt] of Object.entries(pending).slice(0, 20)) {
    try {
      const status = await lookupReceipt(receipt);
      const committed = confirmedResult(status);
      if (!committed) continue;
      delete pending[fingerprint];
      recovered.push(committed);
    } catch { /* Leave it pending for a later visit; never infer success. */ }
  }
  if (recovered.length) savePending(storageKey, pending, false);
  return recovered;
}

function savePending(key: string, pending: Record<string, string>, required: boolean) {
  try { localStorage.setItem(key, JSON.stringify({ receipts: pending })); }
  catch {
    // Persist the receipt before sending a write. After a confirmed write, cleanup
    // is best-effort so browser storage errors cannot turn success into failure.
    if (required) throw new ApiError('このブラウザーに予約の再確認情報を保存できません。ブラウザーの保存設定を確認してから、もう一度お試しください。', 0, 'SUBMISSION_STORAGE_UNAVAILABLE');
  }
}

function parseResult(value: Record<string, unknown>): ConfirmedResult {
  if (typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id <= 0) {
    throw new ApiError('予約 API の応答に有効な予約番号がありません', 0, 'INVALID_RESERVATION_RESULT');
  }
  return { id: value.id, warnings: Array.isArray(value.warnings) ? value.warnings.map(String) : [] };
}

function isUncertain(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500 || error.code === 'INVALID_RESPONSE' || error.code === 'INVALID_RESERVATION_RESULT');
}

function unknownResult(cause?: unknown, postCause?: unknown): ApiError {
  const confirmation = cause instanceof ApiError ? cause : undefined;
  const post = postCause instanceof ApiError ? postCause : undefined;
  return new ApiError('予約結果を確認できません。再送せず、表示された診断 ID を管理者へ伝えてください。',
    confirmation?.status || 0, 'RESERVATION_RESULT_UNKNOWN', undefined, confirmation?.requestId, 'confirmation', post?.requestId);
}

export async function reserve(song: Song | null, singer: string, participantId:string, comment: string, secret = false, keychange = 0): Promise<ConfirmedResult> {
  const form: ReservationInput = {
    filename: song?.name ?? '小休止',
    fullpath: song?.fullpath ?? '',
    singer: singer.trim(),
    participantId,
    comment,
    kind: song ? '動画' : '小休止',
    keychange,
    ...(secret ? { secret: 1 } : {}),
  };
  const fingerprint = await fingerprintInput(form);
  const storageKey = 'yukari.pendingSubmission.v1';
  const pending = readPending(storageKey);
  let receipt = pending[fingerprint];
  if (receipt) {
    let status: ReceiptStatus;
    try { status = await lookupReceipt(receipt); }
    catch (error) { throw unknownResult(markStage(error, 'confirmation')); }
    const committed = confirmedResult(status);
    if (committed) {
      delete pending[fingerprint];
      savePending(storageKey, pending, false);
      return committed;
    }
    if (status.state !== 'not_found') throw unknownResult(new ApiError('予約結果照会 API の応答が不正です', 0, 'INVALID_RECEIPT_STATUS'));
    // A not_found receipt is reused with the exact same input; never mint a new
    // receipt for an operation whose previous response may have been lost.
  } else {
    let intent: Record<string, unknown>;
    try { intent = await apiJson('/requests/intent', { method: 'POST', body: '{}' }); }
    catch (error) { throw markStage(error, 'receipt'); }
    receipt = typeof intent.receipt === 'string' ? intent.receipt : '';
    if (!receipt) throw new ApiError('予約の提出 ID を取得できませんでした', 0, 'SUBMISSION_RECEIPT_UNAVAILABLE');
    pending[fingerprint] = receipt;
    savePending(storageKey, pending, true);
  }

  const send = () => apiJson('/requests', {
    method: 'POST',
    headers: { 'X-Yukari-Submission': receipt! },
    body: JSON.stringify(form),
  });

  let result: ConfirmedResult;
  try {
    result = parseResult(await send());
  } catch (postError) {
    // POST may have committed in MySQL before a proxy timeout or lost response.
    // Always ask the owner-bound receipt before telling the user it failed.
    let status: ReceiptStatus;
    try { status = await lookupReceipt(receipt); }
    catch (confirmError) { throw unknownResult(markStage(confirmError, 'confirmation'), markStage(postError, 'submit')); }
    const committed = confirmedResult(status);
    if (committed) result = committed;
    else if (status.state === 'not_found' && isUncertain(postError)) {
      // The same receipt is protected by a unique MySQL key. A bounded replay of
      // the identical body cannot create a second reservation.
      try { result = parseResult(await send()); }
      catch (retryError) {
        try {
          const finalStatus = await lookupReceipt(receipt);
          const finalResult = confirmedResult(finalStatus);
          if (!finalResult) throw markStage(retryError, 'submit');
          result = finalResult;
        } catch (confirmError) { throw unknownResult(markStage(confirmError, 'confirmation'), markStage(retryError, 'submit')); }
      }
    } else throw markStage(postError, 'submit');
  }

  delete pending[fingerprint];
  savePending(storageKey, pending, false);
  return result;
}
