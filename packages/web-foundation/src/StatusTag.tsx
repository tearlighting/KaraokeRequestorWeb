import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type StatusKind = Extract<IconName, 'queued' | 'playing' | 'completed' | 'failed' | 'uncertain' | 'stopped' | 'paused' | 'unknown'>;
export function StatusTag({ status, children, className = '' }: { status: StatusKind; children: ReactNode; className?: string }) {
  return <span className={`status-tag status-tag-${status} ${className}`.trim()}>
    <Icon name={status} size={15} />
    <span>{children}</span>
  </span>;
}
