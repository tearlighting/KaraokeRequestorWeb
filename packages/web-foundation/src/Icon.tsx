import type { SVGProps } from 'react';

export type IconName = 'search' | 'check' | 'queued' | 'playing' | 'completed' | 'failed' | 'uncertain' | 'stopped' | 'paused' | 'unknown';

/** Small dependency-free outline icons shared by User and Admin. */
export function Icon({ name, size = 18, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  const common = { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const, ...props };
  switch (name) {
    case 'search': return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
    case 'check': return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>;
    case 'queued': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'playing': return <svg {...common}><path d="m9 6 10 6-10 6z" fill="currentColor" stroke="none"/></svg>;
    case 'completed': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>;
    case 'failed': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg>;
    case 'uncertain': return <svg {...common}><path d="M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3h.01"/></svg>;
    case 'stopped': return <svg {...common}><rect x="5" y="5" width="14" height="14" rx="2"/></svg>;
    case 'paused': return <svg {...common}><path d="M9 6v12m6-12v12"/></svg>;
    case 'unknown': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.1 1-1.8 1.3-1.8 2.7m0 3h.01"/></svg>;
  }
}
