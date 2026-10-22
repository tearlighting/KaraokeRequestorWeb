import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Button } from '../../../../../packages/web-foundation/src/primitives';
import { message, type AdminClient, type Settings } from '../../lib/admin';

export function SettingsPage({ client }: { client: AdminClient }) {
  const t=useT(); const [settings,setSettings]=useState<Settings|null>(null); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState(''); const [error,setError]=useState('');
  const load=useCallback(async()=>{try{setSettings(await client<Settings>('settings'));setError('');}catch(cause){setError(message(cause));}},[client]); useEffect(()=>{void load();},[load]);
  async function save(event:FormEvent){event.preventDefault();if(!settings||busy)return;setBusy(true);setError('');setNotice('');try{const saved=await client<Settings>('settings-save',{playmode:String(settings.playmode),startvolume:String(settings.startvolume),requestlistactivereload:String(settings.requestlistactivereload),revision:settings.revision});setSettings(saved);setNotice(saved.changed?t('settingsSaved'):t('settingsUnchanged'));}catch(cause){setError(message(cause));}finally{setBusy(false);}}
  const modeLabels:Record<number,string>={1:t('mode1'),2:t('mode2'),3:t('mode3'),4:t('modeRandom'),5:t('modeRandom')};
  return <section className="panel" aria-busy={!settings&&!error}><p className="eyebrow">SETTINGS</p><h2 className="text-2xl font-bold">{t('settingsTitle')}</h2><p className="mt-2 text-sm text-slate-500">保存は原版の設定 writer に反映されます。変更前に内容を確認してください。</p>
    {!settings&&!error&&<p role="status" className="mt-4 text-sm text-slate-500">{t('loading')}</p>}{error&&<p role="alert" className="error mt-4">{error}</p>}
    {settings&&<form onSubmit={save} className="mt-5 max-w-lg space-y-5"><div><label htmlFor="playmode" className="label">{t('playMode')}</label><select id="playmode" value={settings.playmode} disabled={busy} onChange={event=>setSettings({...settings,playmode:Number(event.target.value)})}>{[1,2,3,4,5].map(mode=><option key={mode} value={mode}>{modeLabels[mode]}</option>)}</select><p className="mt-2 text-xs text-slate-500">この画面は既存設定を表示・保存します。Node が未対応のモードは自動再生に使われません。</p></div>
      <div><label htmlFor="startvolume" className="label">{t('volume')}</label><input type="number" id="startvolume" min={0} max={100} required value={settings.startvolume} disabled={busy} onChange={event=>setSettings({...settings,startvolume:Number(event.target.value)})}/></div>
      <label className="flex items-center gap-3"><input data-testid="setting-auto-refresh" className="w-auto" type="checkbox" checked={settings.requestlistactivereload===1} disabled={busy} onChange={event=>setSettings({...settings,requestlistactivereload:event.target.checked?1:0})}/>{t('autoRefresh')}</label>
      <div className="flex gap-3"><Button data-testid="settings-save" disabled={busy}>{busy?t('submitting'):t('saveSettings')}</Button><Button tone="secondary" type="button" disabled={busy} onClick={()=>void load()}>{t('reload')}</Button></div>
    </form>}{notice&&<p role="status" className="mt-4 text-sm text-emerald-800">{notice}</p>}
  </section>;
}
