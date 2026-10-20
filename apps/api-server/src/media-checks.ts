import { randomUUID } from 'node:crypto';
import { BoundaryError } from './errors.js';

export type MediaCheckResult = 'playable' | 'path_unmapped' | 'file_missing' | 'invalid_path';
interface Check { id: string; requestId: number; path: string; createdAt: number; state: 'pending' | 'claimed' | MediaCheckResult; agentId?: string }

/** Short-lived handoff. Queue paths originate only in request.db, never in browser input. */
export class MediaCheckCoordinator {
  private checks = new Map<string, Check>();
  constructor(private clock = () => Date.now()) {}
  create(requestId: number, path: string) {
    this.expire();
    const check: Check = { id: randomUUID(), requestId, path, createdAt: this.clock(), state: 'pending' };
    this.checks.set(check.id, check);
    return { id: check.id, requestId, state: check.state };
  }
  claim(agentId: string) {
    this.expire();
    const check = [...this.checks.values()].find(item => item.state === 'pending');
    if (!check) return null;
    check.state = 'claimed'; check.agentId = agentId;
    return { id: check.id, requestId: check.requestId, path: check.path };
  }
  complete(id: string, agentId: string, result: MediaCheckResult) {
    this.expire();
    const check = this.checks.get(id);
    if (!check || check.state !== 'claimed' || check.agentId !== agentId) throw new BoundaryError(409, 'STALE_MEDIA_CHECK', 'Media check is no longer assigned to this Agent');
    check.state = result; check.path = '';
    return { id, requestId: check.requestId, state: result };
  }
  read(id: string, requestId: number) {
    this.expire();
    const check = this.checks.get(id);
    if (!check || check.requestId !== requestId) throw new BoundaryError(404, 'MEDIA_CHECK_NOT_FOUND', 'Media check expired or was not found');
    return { id: check.id, requestId: check.requestId, state: check.state };
  }
  private expire() { for (const [id, check] of this.checks) if (this.clock() - check.createdAt > 30_000) this.checks.delete(id); }
}
