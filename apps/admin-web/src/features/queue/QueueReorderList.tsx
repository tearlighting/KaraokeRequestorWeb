import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { QueueItem } from '../../lib/admin';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { StatusTag } from '../../../../../packages/web-foundation/src/StatusTag';
import { Icon } from '../../../../../packages/web-foundation/src/Icon';

/** One visible queue list: local preview, one server commit after drop. */
export function QueueReorderList({
  items, disabled, onCommit, selectedIds = [], onToggleSelected, renderDetails,
}: {
  items: QueueItem[];
  disabled: boolean;
  onCommit: (ids: number[], expectedIds: number[]) => Promise<boolean>;
  selectedIds?: number[];
  onToggleSelected?: (id: number, selected: boolean) => void;
  renderDetails?: (item: QueueItem) => ReactNode;
}) {
  const t = useT();
  const initial = items.map(item => item.id);
  const [order, setOrder] = useState(initial);
  const orderRef = useRef(initial);
  const baseOrder = useRef(initial);
  const [dragging, setDragging] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [targetAfter, setTargetAfter] = useState(false);
  const [saving, setSaving] = useState(false);
  const drag = useRef<{ id: number; active: boolean; timer: number | null; scrollTimer: number | null; x: number; y: number }>({ id: 0, active: false, timer: null, scrollTimer: null, x: 0, y: 0 });
  const rows = new Map(items.map(item => [item.id, item]));
  const itemOrderKey = items.map(item => item.id).join(',');

  useEffect(() => {
    if (dragging === null && !saving) {
      const next = items.map(item => item.id);
      baseOrder.current = next;
      orderRef.current = next;
      setOrder(next);
    }
  }, [itemOrderKey, dragging, saving]);
  useEffect(() => () => {
    if (drag.current.timer !== null) window.clearTimeout(drag.current.timer);
    if (drag.current.scrollTimer !== null) window.clearInterval(drag.current.scrollTimer);
  }, []);
  useEffect(() => {
    document.body.classList.toggle('queue-drag-active', dragging !== null);
    return () => document.body.classList.remove('queue-drag-active');
  }, [dragging]);

  function moveBefore(id: number, overId: number, after: boolean) {
    if (id === overId) return;
    const next = orderRef.current.filter(value => value !== id);
    const at = next.indexOf(overId);
    if (at < 0) return;
    next.splice(at + (after ? 1 : 0), 0, id);
    orderRef.current = next;
    setOrder(next);
    setTarget(overId);
    setTargetAfter(after);
  }

  async function commit() {
    if (saving) return;
    setDragging(null);
    setTarget(null);
    const expected = baseOrder.current;
    const next = orderRef.current;
    if (next.length !== expected.length || next.every((id, index) => id === expected[index])) return;
    setSaving(true);
    const saved = await onCommit(next, expected);
    if (!saved) {
      orderRef.current = expected;
      setOrder(expected);
    }
    setSaving(false);
  }

  useEffect(() => {
    function hitAtPointer() {
      const current = drag.current;
      const node = document.elementFromPoint(current.x, current.y)?.closest<HTMLElement>('[data-sort-id]');
      const overId = Number(node?.dataset.sortId);
      if (node && Number.isSafeInteger(overId)) {
        const rect = node.getBoundingClientRect();
        moveBefore(current.id, overId, current.y > rect.top + rect.height / 2);
      }
    }
    function pointMove(event: PointerEvent) {
      const current = drag.current;
      current.x = event.clientX;
      current.y = event.clientY;
      if (!current.active) {
        if (Math.abs(event.movementX) + Math.abs(event.movementY) > 8 && current.timer !== null) {
          window.clearTimeout(current.timer);
          current.timer = null;
        }
        return;
      }
      hitAtPointer();
      if (current.scrollTimer === null) current.scrollTimer = window.setInterval(() => {
        if (!current.active) return;
        const edge = current.y < 56 ? -24 : current.y > window.innerHeight - 72 ? 24 : 0;
        if (edge) { window.scrollBy({ top: edge, behavior: 'auto' }); hitAtPointer(); }
      }, 50);
    }
    function pointUp() {
      const current = drag.current;
      if (current.timer !== null) window.clearTimeout(current.timer);
      current.timer = null;
      if (current.active) void commit();
      current.active = false;
      if (current.scrollTimer !== null) window.clearInterval(current.scrollTimer);
      current.scrollTimer = null;
    }
    window.addEventListener('pointermove', pointMove);
    window.addEventListener('pointerup', pointUp);
    window.addEventListener('pointercancel', pointUp);
    return () => {
      window.removeEventListener('pointermove', pointMove);
      window.removeEventListener('pointerup', pointUp);
      window.removeEventListener('pointercancel', pointUp);
    };
  });

  function startPointer(event: ReactPointerEvent<HTMLButtonElement>, id: number) {
    if (disabled || saving) return;
    event.preventDefault();
    const current = drag.current;
    current.id = id;
    current.x = event.clientX;
    current.y = event.clientY;
    const activate = () => { current.active = true; setDragging(id); };
    if (event.pointerType === 'touch' || event.pointerType === 'pen') current.timer = window.setTimeout(activate, 350);
    else activate();
  }

  if (!items.length) return null;
  return <section className="queue-reorder" aria-label={t('dragQueueLabel')}>
    <div className="queue-reorder-heading">
      <div><h3 className="font-semibold">{t('dragQueueLabel')}</h3><p className="text-xs text-[var(--muted)]">{t('queueDragInstruction')}</p></div>
      <span className="status-chip">{t('queueItemsCount', { count: items.length })}</span>
    </div>
    <ol className="queue-reorder-list" data-testid="queue-reorder-list" aria-label={t('queueOrderLabel')}>
      {order.map((id, index) => {
        const item = rows.get(id);
        if (!item) return null;
        return <li key={id} data-sort-id={id} data-testid={`sortable-${id}`} className={`queue-reorder-row ${dragging === id ? 'is-dragging' : ''} ${target === id ? `is-drop-target ${targetAfter ? 'drop-after' : 'drop-before'}` : ''}`}>
          {onToggleSelected && <input className="queue-row-select" aria-label={t('selectedQueueItem', { id })} type="checkbox" checked={selectedIds.includes(id)} disabled={disabled || saving} onChange={event => onToggleSelected(id, event.currentTarget.checked)} />}
          <span className="queue-reorder-position" aria-label={t('itemPosition', { position: index + 1 })}>{String(index + 1).padStart(2, '0')}</span>
          <div className="queue-reorder-song"><p className="truncate font-semibold" title={item.display_name}>{item.display_name}</p><p className="truncate text-xs text-[var(--muted)]">{item.singer} · {item.kind}{item.keychange !== 0 ? ` · Key ${item.keychange > 0 ? '+' : ''}${item.keychange}` : ''}</p></div>
          <StatusTag className="queue-sortable-label" status="queued">{t('queueSortable')}</StatusTag>
          <label className="queue-position-control"><span className="sr-only">{t('selectDestinationFor', { title: item.display_name })}</span><select data-testid={`queue-position-${id}`} aria-label={t('selectDestinationFor', { title: item.display_name })} value={index + 1} disabled={disabled || saving} onChange={event => {
            const destination = Number(event.currentTarget.value) - 1;
            const next = [...orderRef.current];
            next.splice(index, 1);
            next.splice(destination, 0, id);
            orderRef.current = next;
            setOrder(next);
          }}><option value={index + 1}>{t('itemPosition', { position: index + 1 })}</option>{items.map((_, at) => at !== index && <option key={at} value={at + 1}>{t('itemPosition', { position: at + 1 })}</option>)}</select></label>
          <button type="button" className="queue-drag-handle" aria-label={t('dragToReorderItem', { title: item.display_name })} title={t('dragToReorder')} disabled={disabled || saving} onPointerDown={event => startPointer(event, id)} onClick={event => event.preventDefault()}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="8" cy="5" r="1.7"/><circle cx="16" cy="5" r="1.7"/><circle cx="8" cy="12" r="1.7"/><circle cx="16" cy="12" r="1.7"/><circle cx="8" cy="19" r="1.7"/><circle cx="16" cy="19" r="1.7"/></svg>
          </button>
          {renderDetails && <details className="queue-row-details"><summary>{t('queueActionsDetails')}</summary><div className="queue-row-details-content">{renderDetails(item)}</div></details>}
        </li>;
      })}
    </ol>
    <div className="queue-save-order"><span className="text-xs text-[var(--muted)]">{t('saveOnDrop')}</span><button type="button" data-testid="admin-save-queue-order" className="secondary inline-flex min-h-10 items-center gap-2" disabled={disabled || saving || order.every((id, index) => id === items[index]?.id)} onClick={() => void commit()}><Icon name="check" size={17}/>{saving ? t('savingOrder') : t('saveOrder')}</button></div>
    {dragging !== null && <p role="status" className="sr-only">{t('dropTargetSelecting')}</p>}
  </section>;
}
