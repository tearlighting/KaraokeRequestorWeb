import { useCallback, useEffect, useState } from 'react';
import { Button, EmptyState } from '../../../../../packages/web-foundation/src/primitives';
import { message, type AdminClient, type ParticipantAdminItem } from '../../lib/admin';

export function ParticipantsPage({ client }: { client: AdminClient }) {
  const [items, setItems] = useState<ParticipantAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await client<{ items: ParticipantAdminItem[] }>('participants');
      setItems(result.items);
      setError('');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { void reload(); }, [reload]);

  async function rename(item: ParticipantAdminItem) {
    const displayName = window.prompt(`「${item.displayName}」の表示名を変更します。過去の予約・履歴は変更されません。`, item.displayName);
    if (!displayName?.trim() || busy) return;
    setBusy(true);
    setNotice('');
    try {
      await client('participant-rename', { id: item.id, displayName: displayName.trim() });
      setNotice('表示名を更新しました。過去の予約・履歴は変更されていません。');
      await reload();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="eyebrow">PARTICIPANTS</p><h2 className="text-2xl font-bold">参加者</h2><p className="mt-2 text-sm text-slate-500">ニックネームは表示情報で、認証情報ではありません。同じ名前の参加者も別 ID のまま管理します。</p></div>
      <Button tone="secondary" disabled={busy || loading} onClick={() => void reload()}>更新</Button>
    </div>
    {error && <p role="alert" className="error mt-4">{error}</p>}
    {notice && <p role="status" className="success-banner mt-4">{notice}</p>}
    {loading && <p role="status" className="mt-4">参加者を読み込み中…</p>}
    <div className="mt-4 divide-y divide-slate-200">{items.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div><h3 className="font-semibold">{item.displayName || 'ニックネーム未設定'} <span className="font-mono text-xs text-slate-400">#{item.id.slice(0, 8)}</span></h3><p className="mt-1 text-sm text-slate-500">この参加者としての予約 {item.reservationCount} 件 · このブラウザーからの履歴 {item.submittedCount} 件</p></div>
      <Button tone="secondary" disabled={busy} onClick={() => void rename(item)}>表示名を変更</Button>
    </article>)}</div>
    {!loading && items.length === 0 && <EmptyState className="mt-4">参加者はまだ登録されていません。User Web でニックネームを保存すると表示されます。</EmptyState>}
  </section>;
}
