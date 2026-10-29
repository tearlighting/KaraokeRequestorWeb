import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../../lib/api';
import { ParticipantPanel } from './ParticipantPanel';
import { Preferences } from '../../../../../packages/web-foundation/src/preferences';
import { formatMediaTitle } from '../search/formatMediaTitle';

type ReservationState = 'queued' | 'playing' | 'completed' | 'stopped' | 'failed' | 'uncertain' | 'unknown';
type OwnedReservation = { id:number; title:string; singer:string; kind:string; status:ReservationState; position:number; requestedAt:number; playbackState:string|null; startedAt:number|null; finishedAt:number|null; errorCode:string|null };
const statusLabel:Record<ReservationState,string>={queued:'待機中',playing:'再生中',completed:'再生済み',stopped:'処理済み',failed:'再生失敗',uncertain:'状態を確認中',unknown:'状態不明'};

export function MyPage(){
  const [items,setItems]=useState<OwnedReservation[]>([]);const [offset,setOffset]=useState(0);const [hasMore,setHasMore]=useState(false);const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const load=useCallback(async(reset=false)=>{if(loading)return;setLoading(true);setError('');try{const from=reset?0:offset;const result=await apiJson(`/user/reservations?limit=20&offset=${from}`);const rows=Array.isArray(result.items)?result.items as OwnedReservation[]:[];setItems(current=>reset?rows:[...current,...rows]);setOffset(typeof result.nextOffset==='number'?result.nextOffset:from+rows.length);setHasMore(result.hasMore===true);}catch(cause){setError(cause instanceof Error?cause.message:'予約情報を読み込めませんでした');}finally{setLoading(false);}},[loading,offset]);
  useEffect(()=>{void load(true);},[]);
  const current=items.filter(item=>item.status==='queued'||item.status==='playing');
  const past=items.filter(item=>!current.includes(item));
  return <section className="user-page-stack" aria-labelledby="my-page-title" data-testid="my-page">
    <header className="user-page-heading"><h1 id="my-page-title">マイページ</h1></header>
    <ParticipantPanel/>
    <section className="user-settings" aria-label="アプリ設定"><h2>アプリ設定</h2><Preferences/></section>
    {error&&<p role="alert" className="error">{error}</p>}
    <section className="panel"><h2 className="text-lg font-bold">自分の予約</h2>
      {loading&&items.length===0&&<p role="status" className="mt-3 text-sm text-[var(--muted)]">読み込み中…</p>}
      {!loading&&items.length===0&&!error&&<p className="empty-state mt-3">このブラウザーからの予約はまだありません。</p>}
      {current.length>0&&<><h3 className="mt-4 font-semibold">待機中・再生中</h3><ul className="mt-2 divide-y divide-[var(--border)]">{current.map(item=><ReservationRow key={item.id} item={item}/>)}</ul></>}
      {past.length>0&&<><h3 className="mt-5 font-semibold">再生履歴</h3><ul className="mt-2 divide-y divide-[var(--border)]">{past.map(item=><ReservationRow key={item.id} item={item}/>)}</ul></>}
      {hasMore&&<button type="button" className="secondary mt-4 min-h-11" disabled={loading} onClick={()=>void load(false)}>{loading?'読み込み中…':'さらに読み込む'}</button>}
      <p className="mt-3 text-xs text-[var(--muted)]">同じニックネームでも別のブラウザーの予約は表示されません。ニックネームは表示名で、本人確認には使われません。</p>
    </section>
  </section>;
}
function ReservationRow({item}:{item:OwnedReservation}){
  const date=(value:number|null)=>value&&Number.isFinite(value)?new Date(value*1000).toLocaleString():'—';
  return <li className="my-reservation-row" data-testid={`my-reservation-${item.id}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium">{formatMediaTitle(item.title)}</p><p className="mt-1 text-sm text-[var(--muted)]">{item.singer} · {item.kind}</p>{item.status==='queued'&&<p className="mt-1 text-xs text-[var(--muted)]">順番 #{item.position}</p>}</div><span className="status-chip shrink-0">{statusLabel[item.status]||statusLabel.unknown}</span></div><p className="mt-2 text-xs text-[var(--muted)]">予約 {date(item.requestedAt)} · 再生開始 {date(item.startedAt)} · 終了 {date(item.finishedAt)}</p>{item.playbackState&&<p className="mt-1 text-xs text-[var(--muted)]">Playback: {item.playbackState}{item.errorCode?` · ${item.errorCode}`:''}</p>}</li>;
}
