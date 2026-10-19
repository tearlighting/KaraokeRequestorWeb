/** Behavior port of MoveItem; checked against the actual PHP implementation. */
export interface OrderRow { id: number; reqorder: number; singer: string; kind: string; nowplaying: string }
export function automaticOrder(rows: OrderRow[], id: number, reset: boolean, midjoin: boolean) {
  const fresh = rows.find(r => r.id === id)!;
  const old = rows.filter(r => r.id !== id);
  const played = Math.max(0, ...old.filter(r => r.nowplaying !== '未再生').map(r=>r.reqorder));
  let position: number;
  const memory = reset ? Math.max(0, ...old.filter(r=>r.kind==='小休止').map(r=>r.reqorder)) : 0;
  const floor = Math.max(played,memory);
  const history = old.filter(r=>r.reqorder>memory && r.kind!=='小休止');
  const end = (round: OrderRow[]) => {
    const eligible=round.filter(r=>r.reqorder>floor), unplayed=eligible.filter(r=>r.nowplaying==='未再生');
    return Math.max(floor,...(unplayed.length?unplayed:eligible).map(r=>r.reqorder));
  };
  if (fresh.kind==='小休止') position=Math.max(played,...old.filter(r=>r.nowplaying==='未再生').map(r=>r.reqorder))+1;
  else if (!history.length) position=floor+1;
  else {
    const rounds: OrderRow[][]=[]; let round: OrderRow[]=[];
    // PHP in_array default is loose: numeric singer strings compare numerically.
    const equal=(a:string,b:string)=>a===b || (a.trim()!=='' && b.trim()!=='' && Number.isFinite(Number(a)) && Number(a)===Number(b));
    for (const row of history) { if(round.some(r=>equal(r.singer,row.singer))) { rounds.push(round);round=[]; } round.push(row); }
    if(round.length)rounds.push(round);
    const index=midjoin ? rounds.findIndex(r=>!r.some(x=>x.singer===fresh.singer)) : rounds.reduce((last,r,i)=>r.some(x=>x.singer===fresh.singer)?i:last,-1)+1;
    if(index<0 || index>=rounds.length) position=Math.max(floor,...history.filter(r=>r.reqorder>floor && r.nowplaying==='未再生').map(r=>r.reqorder))+1;
    else if(index===0) {
      const veteran=rounds[0].some(t=>rows.some(r=>r.singer===t.singer && r.nowplaying!=='未再生'));
      position=!reset&&veteran ? (history.find(r=>r.reqorder>floor && r.nowplaying==='未再生')?.reqorder ?? floor+1) : end(rounds[0])+1;
    } else {
      const previous=rounds[index-1], self=previous.findIndex(r=>r.singer===fresh.singer);
      const after=self<0?[]:previous.slice(self+1).map(r=>r.singer);
      position=rounds[index].find(r=>r.reqorder>floor && r.nowplaying==='未再生' && after.some(s=>equal(s,r.singer)))?.reqorder ?? end(rounds[index])+1;
    }
  }
  const target=old.filter(r=>r.reqorder<position).length+1;
  let next=1;
  return rows.map(row=>{ if(row.id===id)return {...row,reqorder:target}; if(next===target)next++;return {...row,reqorder:next++}; });
}
