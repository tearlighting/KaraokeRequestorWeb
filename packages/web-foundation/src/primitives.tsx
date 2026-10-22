import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
export function Button({ tone = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'secondary' | 'danger' }) {
  return <button {...props} className={`${tone === 'primary' ? 'ui-button-primary' : tone === 'danger' ? 'ui-button-danger' : 'ui-button-secondary'} ${className}`} />;
}
export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) { return <section {...props} className={`ui-card ${className}`} />; }
export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) { return <span className={`ui-badge ${className}`}>{children}</span>; }
export function EmptyState({ children, className = '' }: { children: ReactNode; className?: string }) { return <div className={`ui-empty ${className}`}>{children}</div>; }
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} />; }
export function Dialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return <div className="ui-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="ui-dialog" role="dialog" aria-modal="true" aria-label={title}><h2>{title}</h2>{children}</section></div>;
}
