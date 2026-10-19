import { ApiError, apiJson } from '../../lib/api';
import type { ReservationInput } from '../../../../../packages/contracts/src/index';
import type { Song } from '../search/api';

export async function reserve(song: Song | null, singer: string, comment: string): Promise<number> {
  const form: ReservationInput = {
    filename: song?.name ?? '小休止',
    fullpath: song?.fullpath ?? '',
    singer: singer.trim(),
    comment,
    kind: song ? '動画' : '小休止',
  };
  const result = await apiJson('/requests', {
    method: 'POST',
    body: JSON.stringify(form),
  });
  if (typeof result.id !== 'number' || !Number.isSafeInteger(result.id) || result.id <= 0) {
    throw new ApiError('原预约接口未返回有效 newid，未确认预约成功。请先刷新队列。');
  }
  return result.id;
}
