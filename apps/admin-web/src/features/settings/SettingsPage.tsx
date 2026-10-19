import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { message, type AdminClient, type Settings } from '../../lib/admin';

export function SettingsPage({ client }: { client: AdminClient }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => { try { setSettings(await client<Settings>('settings')); setError(''); } catch (error) { setError(message(error)); } }, [client]);
  useEffect(() => { void load(); }, [load]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (!settings || busy) return; setBusy(true); setError(''); setNotice('');
    try { const saved = await client<Settings>('settings-save', { playmode: String(settings.playmode), startvolume: String(settings.startvolume), requestlistactivereload: String(settings.requestlistactivereload), revision: settings.revision }); setSettings(saved); setNotice(saved.changed ? '设置已保存并由服务端重新读取。' : '设置没有变化，未写入配置文件。'); }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  return <section className="panel"><h2 className="text-2xl font-bold">管理设置</h2><p className="mt-2 text-sm text-slate-500">迁移原版播放模式、初始音量及主动刷新设置。保存会使用原配置写入流程。</p>
    {settings && <form onSubmit={save} className="mt-5 max-w-lg space-y-5"><div><label htmlFor="playmode" className="label">播放模式</label><select id="playmode" value={settings.playmode} disabled={busy} onChange={(event) => setSettings({ ...settings, playmode: Number(event.target.value) })}>{['自动开始', '手动开始', '手动加入播放列表', 'BGM 点唱机', 'BGM 随机'].map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></div>
      <div><label htmlFor="startvolume" className="label">初始音量（0–100）</label><input type="number" id="startvolume" min={0} max={100} required value={settings.startvolume} disabled={busy} onChange={(event) => setSettings({ ...settings, startvolume: Number(event.target.value) })} /></div>
      <label className="flex items-center gap-3"><input className="w-auto" type="checkbox" checked={settings.requestlistactivereload === 1} disabled={busy} onChange={(event) => setSettings({ ...settings, requestlistactivereload: event.target.checked ? 1 : 0 })} />原版队列主动刷新</label>
      <div className="flex gap-3"><button className="primary" disabled={busy}>{busy ? '保存中…' : '保存设置'}</button><button type="button" className="secondary" disabled={busy} onClick={() => void load()}>重新加载</button></div>
    </form>}{notice && <p role="status" className="mt-4 text-sm text-indigo-700">{notice}</p>}{error && <p role="alert" className="error mt-4">{error}</p>}
  </section>;
}
