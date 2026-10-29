import test from 'node:test';
import assert from 'node:assert/strict';
import { MpvJsonIpcAdapter } from '../src/mpv.js';

test('connected idle mpv distinguishes unavailable media properties from an IPC failure',async()=>{
  const adapter=new MpvJsonIpcAdapter(process.execPath);Object.assign(adapter,{socket:{destroyed:false},commandExisting:async(command:unknown[])=>{
    if(command[1]==='path'||command[1]==='duration'||command[1]==='time-pos')throw new Error('mpv IPC: property unavailable');
    if(command[1]==='idle-active')return true;if(command[1]==='track-list')return [];return false;
  }});
  const status=await adapter.getStatus();assert.equal(status.connected,true);assert.equal(status.state,'idle');assert.deepEqual(status.audioTracks,[]);assert.deepEqual(status.subtitleTracks,[]);
});

test('live status reads mpv properties and dynamically reports selected tracks without starting mpv',async()=>{
  const adapter=new MpvJsonIpcAdapter(process.execPath);
  const sent:unknown[][]=[];let spawned=false;
  Object.assign(adapter,{
    socket:{destroyed:false},
    command:async()=>{spawned=true;throw new Error('must not start a player during status reads');},
    commandExisting:async(command:unknown[])=>{
      sent.push(command);
      const properties:Record<string,unknown>={'idle-active':false,pause:false,path:'C:\\media\\concert.mkv',duration:123.5,'time-pos':22.25,volume:63,mute:true,'audio-delay':0.125,fullscreen:true,'track-list':[
        {id:1,type:'audio',title:'Original',lang:'ja',codec:'aac',selected:false},
        {id:7,type:'audio',title:'Instrumental',lang:'ja',codec:'flac',selected:true},
        {id:4,type:'sub',title:'Lyrics',lang:'ja',codec:'ass',selected:true},
        {id:5,type:'sub',title:'C:\\Users\\private\\caption.srt',selected:false},
      ]};
      return properties[String(command[1])];
    },
  });
  const status=await adapter.getStatus();
  assert.equal(status.connected,true);assert.equal(status.state,'playing');assert.equal(status.file,'concert.mkv');
  assert.equal(status.duration,123.5);assert.equal(status.position,22.25);assert.equal(status.volume,63);assert.equal(status.muted,true);assert.equal(status.audioDelay,0.125);assert.equal(status.fullscreen,true);
  assert.deepEqual(status.audioTracks.map(track=>[track.id,track.selected]),[[1,false],[7,true]]);
  assert.equal(status.selectedAudioTrackId,7);assert.equal(status.selectedSubtitleTrackId,4);
  assert.equal(status.subtitleTracks.find(track=>track.id===5)?.title,undefined,'absolute filesystem metadata must not leak to Admin');
  assert.equal(spawned,false);assert.ok(sent.some(command=>command[1]==='track-list'));
  assert.equal(status.path,'C:\\media\\concert.mkv'); // internal Agent-only field, stripped before reporting
});

test('unavailable IPC is reported honestly and never launches mpv',async()=>{
  const adapter=new MpvJsonIpcAdapter(process.execPath);let spawned=false;
  Object.assign(adapter,{connect:async()=>{throw new Error('pipe missing');},command:async()=>{spawned=true;}});
  assert.deepEqual(await adapter.getStatus(),{connected:false,state:'unavailable',audioTracks:[],subtitleTracks:[],error:'MPV_IPC_UNAVAILABLE'});
  assert.equal(spawned,false);
});

test('key filter is installed once with a fixed label and unsupported builds fail closed',async()=>{
  const adapter=new MpvJsonIpcAdapter(process.execPath);const filters:unknown[]=[];const sent:unknown[][]=[];
  Object.assign(adapter,{commandExisting:async(command:unknown[])=>{sent.push(command);if(command[0]==='get_property')return [...filters];if(command[0]==='af'&&command[1]==='add'){filters.push({label:'yukari-key',name:'rubberband',params:{'pitch-scale':'1'}});return;}if(command[0]==='af-command')return;}});
  await (adapter as unknown as {prepareKeyFilter():Promise<void>}).prepareKeyFilter();
  assert.deepEqual(sent,[['get_property','af'],['af','add','@yukari-key:rubberband=pitch-scale=1'],['get_property','af'],['af-command','yukari-key','set-pitch','1']]);
  const unsupported=new MpvJsonIpcAdapter(process.execPath);Object.assign(unsupported,{commandExisting:async(command:unknown[])=>command[0]==='get_property'?[]:undefined});
  await assert.rejects((unsupported as unknown as {prepareKeyFilter():Promise<void>}).prepareKeyFilter(),/MPV_KEY_CHANGE_UNAVAILABLE/);
});

test('a queued nonzero key is applied before mpv resumes and unsupported builds fail closed',async()=>{
  const adapter=new MpvJsonIpcAdapter(process.execPath),sent:unknown[][]=[];const filters:unknown[]=[];let paused=false;
  Object.assign(adapter,{
    command:async(command:unknown[])=>{sent.push(command);if(command[0]==='loadfile')queueMicrotask(()=>{for(const listener of (adapter as unknown as {fileLoadedListeners:Set<()=>void>}).fileLoadedListeners)listener();});},
    commandExisting:async(command:unknown[])=>{sent.push(command);if(command[0]==='set_property'&&command[1]==='pause'){paused=Boolean(command[2]);return;}if(command[0]==='get_property'&&command[1]==='af')return [...filters];if(command[0]==='af'&&command[1]==='add'){filters.push({label:'yukari-key',name:'rubberband',params:{'pitch-scale':'1'}});return;}if(command[0]==='af-command'){filters[0]={label:'yukari-key',name:'rubberband',params:{'pitch-scale':String(command[3])}};return;}},
    getStatus:async()=>({connected:true,state:paused?'paused':'playing',path:'C:\\media\\fixture.mp4',file:'fixture.mp4',audioTracks:[],subtitleTracks:[],keyChangeAvailable:true,keySemitones:3}),
  });
  await adapter.open('C:\\media\\fixture.mp4',3);
  const pitch=2**(3/12);
  assert.deepEqual(sent.slice(0,1),[['set_property','pause',true]]);
  assert.ok(sent.some(command=>command[0]==='af-command'&&command[1]==='yukari-key'&&command[2]==='set-pitch'&&command[3]===String(pitch)));
  assert.deepEqual(sent.at(-1),['set_property','pause',false]);

  const unsupported=new MpvJsonIpcAdapter(process.execPath);const unsupportedCommands:unknown[][]=[];
  Object.assign(unsupported,{command:async(command:unknown[])=>{if(command[0]==='loadfile')queueMicrotask(()=>{for(const listener of (unsupported as unknown as {fileLoadedListeners:Set<()=>void>}).fileLoadedListeners)listener();});},commandExisting:async(command:unknown[])=>{unsupportedCommands.push(command);return command[0]==='get_property'?[]:undefined;},getStatus:async()=>({connected:true,state:'paused',path:'C:\\media\\fixture.mp4',audioTracks:[],subtitleTracks:[]})});
  await assert.rejects(unsupported.open('C:\\media\\fixture.mp4',2),/MPV_KEY_CHANGE_UNAVAILABLE/);
  assert.equal(unsupportedCommands.some(command=>command[0]==='set_property'&&command[1]==='pause'&&command[2]===false),false,'unsupported pitch must remain paused and fail rather than play in the wrong key');
});

test('reported key tracks the last successful Rubber Band command, not static mpv filter options',async()=>{
  const adapter=new MpvJsonIpcAdapter(process.execPath);const filter={label:'yukari-key',name:'rubberband',params:{'pitch-scale':'1'}};
  const props:Record<string,unknown>={'idle-active':false,pause:false,path:'C:\\media\\fixture.mp4',duration:30,'time-pos':4,volume:50,mute:false,'audio-delay':0,fullscreen:false,'track-list':[],'af':[filter]};
  Object.assign(adapter,{socket:{destroyed:false},commandExisting:async(command:unknown[])=>command[0]==='get_property'?(command[1]==='af'?[filter]:props[String(command[1])]):undefined});
  await (adapter as unknown as {prepareKeyFilter():Promise<void>}).prepareKeyFilter();
  await adapter.applyControl({id:'key-1',taskId:'task-1',action:'key-change',semitones:2});
  const status=await adapter.getStatus();
  assert.equal(status.keyChangeAvailable,true);assert.equal(status.keySemitones,2,'mpv af options stay at their initial value even though the dynamic set-pitch command succeeded');
});

test('safe control actions map to mpv properties and reject stale track IDs',async()=>{
  const adapter=new MpvJsonIpcAdapter(process.execPath);const sent:unknown[][]=[];
  const status={connected:true,state:'playing' as const,file:'test.mkv',duration:90,position:2,volume:50,muted:false,
    audioTracks:[{id:3,title:'Vocal',selected:true},{id:9,title:'Off vocal',selected:false}],selectedAudioTrackId:3,
    subtitleTracks:[{id:5,title:'Lyrics',selected:false}],keyChangeAvailable:true,keySemitones:0};
  Object.assign(adapter,{getStatus:async()=>status,commandExisting:async(command:unknown[])=>{sent.push(command);}});
  await adapter.applyControl({id:'c1',taskId:'t1',action:'seek',position:12});
  await adapter.applyControl({id:'c2',taskId:'t1',action:'volume',value:75});
  await adapter.applyControl({id:'c8',taskId:'t1',action:'volume',value:110});
  await adapter.applyControl({id:'c3',taskId:'t1',action:'mute',value:true});
  await adapter.applyControl({id:'c4',taskId:'t1',action:'audio-track',trackId:9});
  await adapter.applyControl({id:'c5',taskId:'t1',action:'subtitle-track',trackId:null});
  await adapter.applyControl({id:'c10',taskId:'t1',action:'audio-delay',value:0.1});
  await adapter.applyControl({id:'c11',taskId:'t1',action:'fullscreen',value:true});
  await adapter.applyControl({id:'c13',taskId:'t1',action:'key-change',semitones:1});
  await adapter.applyControl({id:'c14',taskId:'t1',action:'key-change',semitones:0});
  assert.deepEqual(sent,[['seek',12,'absolute+exact'],['set_property','volume',75],['set_property','volume',110],['set_property','mute',true],['set_property','aid',9],['set_property','sid','no'],['set_property','audio-delay',0.1],['set_property','fullscreen',true],['af-command','yukari-key','set-pitch',String(2**(1/12))],['af-command','yukari-key','set-pitch','1']]);
  await assert.rejects(adapter.applyControl({id:'c6',taskId:'t1',action:'audio-track',trackId:999}),/MPV_AUDIO_TRACK_UNAVAILABLE/);
  await assert.rejects(adapter.applyControl({id:'c9',taskId:'t1',action:'volume',value:131}),/MPV_INVALID_VOLUME/);
  await assert.rejects(adapter.applyControl({id:'c7',taskId:'t1',action:'seek',position:91}),/MPV_INVALID_SEEK/);
  await assert.rejects(adapter.applyControl({id:'c12',taskId:'t1',action:'audio-delay',value:11}),/MPV_INVALID_AUDIO_DELAY/);
  await assert.rejects(adapter.applyControl({id:'c15',taskId:'t1',action:'key-change',semitones:7}),/MPV_INVALID_KEY_CHANGE/);
  Object.assign(adapter,{getStatus:async()=>({...status,keyChangeAvailable:false})});
  await assert.rejects(adapter.applyControl({id:'c16',taskId:'t1',action:'key-change',semitones:1}),/MPV_KEY_CHANGE_UNAVAILABLE/);
});

test('initial volume is validated and applied through a single explicit mpv IPC command',async()=>{
  const adapter=new MpvJsonIpcAdapter(process.execPath);const sent:unknown[][]=[];
  Object.assign(adapter,{command:async(command:unknown[])=>{sent.push(command);}});
  await adapter.setInitialVolume(0);
  await adapter.setInitialVolume(87);
  await assert.rejects(adapter.setInitialVolume(101),/Invalid configured start volume/);
  await assert.rejects(adapter.setInitialVolume(-1),/Invalid configured start volume/);
  assert.deepEqual(sent,[['set_property','volume',0],['set_property','volume',87]]);
});

test('danmaku overlay uses mpv JSON IPC command-name compatibility format on the existing socket',async()=>{
  const adapter=new MpvJsonIpcAdapter(process.execPath);const sent:unknown[]=[];
  const internals=adapter as unknown as {socket:{destroyed:boolean;write(data:string):boolean};receive:(message:{request_id:number;error:string})=>void};
  internals.socket={destroyed:false,write(data:string){const packet=JSON.parse(data) as {command:unknown;request_id:number};sent.push(packet.command);queueMicrotask(()=>internals.receive({request_id:packet.request_id,error:'success'}));return true;}};
  await adapter.setOverlayData('ASS frame');
  await adapter.setOverlayData(null);
  assert.deepEqual(sent,[
    {name:'osd-overlay',id:48211,format:'ass-events',data:'ASS frame',res_x:1280,res_y:720,z:20},
    {name:'osd-overlay',id:48211,format:'none',data:''},
  ]);
});
