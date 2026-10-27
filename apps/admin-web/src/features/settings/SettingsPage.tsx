import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useT } from '../../../../../packages/web-foundation/src/i18n';
import { Button } from '../../../../../packages/web-foundation/src/primitives';
import { message, type AdminClient, type PlayerAgentStatus, type Settings } from '../../lib/admin';

export function SettingsPage({ client }: { client: AdminClient }) {
  const t=useT();
  const legacySettingsUrl=import.meta.env.DEV?`${window.location.protocol}//${window.location.hostname}:8180/init.php`:'/init.php';
  const [settings,setSettings]=useState<Settings|null>(null);
  const [agent,setAgent]=useState<PlayerAgentStatus|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [runtimeError,setRuntimeError]=useState('');
  const load=useCallback(async()=>{
    const [settingsResult,agentResult]=await Promise.allSettled([
      client<Settings>('settings'),client<PlayerAgentStatus>('player-agent-status'),
    ]);
    if(settingsResult.status==='fulfilled'){setSettings(settingsResult.value);setError('');}
    else setError(message(settingsResult.reason));
    if(agentResult.status==='fulfilled'){setAgent(agentResult.value);setRuntimeError('');}
    else {setAgent(null);setRuntimeError(message(agentResult.reason));}
  },[client]);
  useEffect(()=>{void load();},[load]);
  async function save(event:FormEvent){
    event.preventDefault();if(!settings||busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const saved=await client<Settings>('settings-save',{
        playmode:String(settings.playmode),startvolume:String(settings.startvolume),
        requestlistactivereload:String(settings.requestlistactivereload),revision:settings.revision,
        request_automove:String(settings.request_automove),request_automove_reset:String(settings.request_automove_reset),
        request_automove_midjoin_first:String(settings.request_automove_midjoin_first),
      });
      setSettings(saved);setNotice(saved.changed?t('settingsSaved'):t('settingsUnchanged'));
    }catch(cause){setError(message(cause));}
    finally{setBusy(false);}
  }
  const modeLabels:Record<number,string>={1:t('mode1'),2:t('mode2'),3:t('mode3'),4:t('modeRandom'),5:t('modeRandom')};
  const modeStatus=settings?.playmode!==1&&settings?.playmode!==2
    ? t('modeRuntimeUnavailable',{mode:settings?.playmode??'—'})
    : !agent ? runtimeError || t('modeRuntimeBlocked',{reason:'Live Agent status is unavailable'})
    : !agent.nodeAutoplayAvailable ? t('modeRuntimeBlocked',{mode:settings?.playmode??'—',reason:agent.autoplayUnavailableReason||'Node scheduler is unavailable'})
    : !agent.connected ? t('modeRuntimeBlocked',{mode:settings?.playmode??'—',reason:'Windows Media Agent is offline'})
    : agent.autoplayEnabled ? settings?.playmode===2?t('manualRuntimeActive'):t('modeRuntimeActive')
    : settings?.playmode===2 ? t('manualRuntimeReady') : t('modeRuntimeReady');

  return <section className="panel" aria-busy={!settings&&!error}>
    <p className="eyebrow">SETTINGS</p>
    <h2 className="text-2xl font-bold">{t('settingsTitle')}</h2>
    <p className="mt-2 text-sm text-slate-500">{t('settingsOwner')}</p>
    {!settings&&!error&&<p role="status" className="mt-4 text-sm text-slate-500">{t('loading')}</p>}
    {error&&<p role="alert" className="error mt-4">{error}</p>}
    {settings&&<form onSubmit={save} className="mt-5 max-w-lg space-y-5">
      <div>
        <label htmlFor="playmode" className="label">{t('playMode')}</label>
        <select id="playmode" data-testid="settings-playmode" value={settings.playmode} disabled={busy} onChange={event=>setSettings({...settings,playmode:Number(event.target.value)})}>
          <option value={1}>{t('mode1')}</option><option value={2}>{t('mode2')}</option>
          {settings.playmode!==1&&settings.playmode!==2&&<option value={settings.playmode} disabled>{t('modeRuntimeUnavailable',{mode:settings.playmode})}</option>}
        </select>
        <p data-testid="playmode-runtime-status" role="status" className="mt-2 text-xs text-slate-600">{modeStatus}</p>
        {runtimeError&&<p className="mt-1 text-xs text-amber-700">{runtimeError}</p>}
        <p className="mt-1 text-xs text-slate-500">{t('schedulerActionHint')}</p>
      </div>
      <div>
        <label htmlFor="startvolume" className="label">{t('volume')}</label>
        <input type="number" id="startvolume" data-testid="settings-startvolume" min={0} max={100} required value={settings.startvolume} disabled={busy} onChange={event=>setSettings({...settings,startvolume:Number(event.target.value)})} />
        <p className="mt-2 text-xs text-slate-600">{t('defaultVolumeDescription')}</p>
        {agent?.mpv?.connected&&agent.mpv.volume!==undefined&&<p className="mt-1 text-xs text-slate-500">{t('currentMpvVolume')}: {Math.round(agent.mpv.volume)}%</p>}
      </div>
      <label className="flex items-center gap-3">
        <input data-testid="setting-auto-refresh" className="w-auto" type="checkbox" checked={settings.requestlistactivereload===1} disabled readOnly />
        {t('autoRefresh')}
      </label>
      <p className="-mt-3 text-xs text-slate-600">{t('refreshLegacyOnly')}</p>
      <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-2 text-sm font-semibold">{t('requestOrderSettings')}</legend>
        <label className="flex items-center gap-3"><input data-testid="settings-request-automove" className="w-auto" type="checkbox" checked={settings.request_automove===1} disabled={busy} onChange={event=>setSettings({...settings,request_automove:event.target.checked?1:0})}/>{t('requestAutomove')}</label>
        <label className="flex items-center gap-3"><input data-testid="settings-request-automove-reset" className="w-auto" type="checkbox" checked={settings.request_automove_reset===1} disabled={busy} onChange={event=>setSettings({...settings,request_automove_reset:event.target.checked?1:0})}/>{t('requestAutomoveReset')}</label>
        <label className="flex items-center gap-3"><input data-testid="settings-request-automove-midjoin" className="w-auto" type="checkbox" checked={settings.request_automove_midjoin_first===1} disabled={busy} onChange={event=>setSettings({...settings,request_automove_midjoin_first:event.target.checked?1:0})}/>{t('requestAutomoveMidjoin')}</label>
        <p className="text-xs text-slate-600">{t('requestOrderSettingsDescription')}</p>
      </fieldset>
      <div className="flex gap-3">
        <Button data-testid="settings-save" disabled={busy}>{busy?t('submitting'):t('saveSettings')}</Button>
        <Button tone="secondary" type="button" disabled={busy} onClick={()=>void load()}>{t('reload')}</Button>
      </div>
    </form>}
    {notice&&<p role="status" className="mt-4 text-sm text-emerald-800">{notice}</p>}
    <p className="mt-5 border-t border-slate-200 pt-4 text-sm"><a className="underline" href={legacySettingsUrl} target="_blank" rel="noreferrer">{t('legacySettingsViewOnly')}</a></p>
  </section>;
}
