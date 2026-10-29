import { useEffect, useState } from 'react';
import { Button } from '../../../../../packages/web-foundation/src/primitives';
import { errorMessage } from '../../lib/api';
import { loadParticipantProfile, saveParticipantName } from './api';
import { setParticipantProfile, useParticipantStore } from '../../store/participantStore';

export function ParticipantPanel(){
  const profile=useParticipantStore(state=>state.profile),loading=useParticipantStore(state=>state.loading),saving=useParticipantStore(state=>state.saving),error=useParticipantStore(state=>state.error);
  const [name,setName]=useState('');
  useEffect(()=>{let active=true;void loadParticipantProfile().then(data=>{if(active){setParticipantProfile(data);setName(data.displayName);}}).catch(cause=>{if(active)useParticipantStore.setState({loading:false,error:errorMessage(cause)});});return()=>{active=false;};},[]);
  useEffect(()=>{if(profile)setName(profile.displayName);},[profile?.displayName]);
  async function save(){if(saving||!name.trim())return;useParticipantStore.setState({saving:true,error:''});try{const saved=await saveParticipantName(name.trim());setParticipantProfile(saved);setName(saved.displayName);}catch(cause){useParticipantStore.setState({error:errorMessage(cause)});}finally{useParticipantStore.setState({saving:false});}}
  return <section className="panel mb-5" aria-label="点歌人">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div><label className="field-label" htmlFor="participant-own-name">あなたの点歌ニックネーム</label><input id="participant-own-name" maxLength={64} value={name} onChange={event=>setName(event.target.value)} placeholder="ニックネームを入力" disabled={loading||saving}/></div>
      <Button tone="secondary" disabled={loading||saving||!name.trim()} onClick={()=>void save()}>{saving?'保存中…':'ニックネームを保存'}</Button>
    </div>
    <p className="mt-2 text-xs text-slate-500">ニックネームは表示用です。予約の履歴と操作権限はこのブラウザーのセッションに紐づきます。</p>
    {profile&&<p className="mt-1 text-sm">現在の点歌人：<strong>{profile.displayName}</strong></p>}
    {loading&&<p role="status" className="mt-2 text-sm text-slate-500">参加者情報を読み込み中…</p>}{error&&<p role="alert" className="error mt-2">参加者情報：{error}</p>}
  </section>;
}
