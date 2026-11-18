import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
const A='UC'+'a'.repeat(22),B='UC'+'b'.repeat(22),id1='aaaaaaaaaaa',id2='bbbbbbbbbbb',upload='ccccccccccc';
const tick=()=>new Promise(r=>setImmediate(r));
test('real workspace markup: comma pause, categories, feeds, copy, move from regular playlist and restore',async()=>{
 const {window,document}=parseHTML(await readFile(new URL('../app.html',import.meta.url),'utf8'));
 globalThis.window=window;globalThis.document=document;globalThis.Event=window.Event;globalThis.CustomEvent=window.CustomEvent;
 globalThis.confirm=()=>true;window.requestAnimationFrame=fn=>fn();window.scrollTo=()=>{};
 window.HTMLElement.prototype.showModal=function(){this.open=true;};window.HTMLElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return [...this.options].find(o=>o.hasAttribute('selected'))?.getAttribute('value')||this.options[0]?.getAttribute('value')||'';},set(value){for(const option of this.options){if(option.getAttribute('value')===String(value))option.setAttribute('selected','');else option.removeAttribute('selected');}}});
 Object.defineProperty(window.HTMLInputElement.prototype,'checked',{configurable:true,get(){return this.hasAttribute('checked');},set(value){if(value)this.setAttribute('checked','');else this.removeAttribute('checked');}});
 const originalForm=globalThis.FormData;globalThis.FormData=class{constructor(form){this.data=[];form.querySelectorAll('input,select').forEach(i=>{if(i.name&&((i.type!=='checkbox'&&i.type!=='radio')||i.checked))this.data.push([i.name,i.value]);});}get(name){return this.data.find(x=>x[0]===name)?.[1]??null;}getAll(name){return this.data.filter(x=>x[0]===name).map(x=>x[1]);}has(name){return this.data.some(x=>x[0]===name);}};
 Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:{request:async(n,o,fn)=>fn({})}});
 const cache={},requests=[],playlists=new Map();let historyFailure=false;
 function row(videoId,title,channel=A){return {setVideoId:`set-${videoId}`,videoId,title:{simpleText:title},shortBylineText:{runs:[{text:channel===A?'The Race':'Another channel',navigationEndpoint:{browseEndpoint:{browseId:channel}}}]},lengthText:{simpleText:'5:30'},thumbnailOverlays:[{thumbnailOverlayResumePlaybackRenderer:{percentDurationWatched:48}}]};}
 const originals=new Map([[id1,row(id1,'Race weekend')],[id2,row(id2,'Other video',B)]]);
 playlists.set('WL',[...originals.values()]);playlists.set('PL_TARGET',[]);
 const library={categories:[{id:'sport',name:'Sports'},{id:'f1',name:'Football'}],channels:[{id:A,name:'The Race',cats:['sport','f1'],added:true}],feeds:[]};cache['feeds:owner']=library;
 const response=data=>[{result:{ok:true,data}}];
 globalThis.chrome={storage:{local:{get:async keys=>structuredClone(keys===null?cache:Array.isArray(keys)?Object.fromEntries(keys.map(k=>[k,cache[k]])):{[keys]:cache[keys]}),set:async data=>Object.assign(cache,structuredClone(data))}},tabs:{query:async()=>[{id:1,title:'Watch Later - YouTube',url:'https://www.youtube.com/playlist?list=WL'}]},scripting:{executeScript:async({args:[operation,payload]})=>{
  requests.push({operation,...payload});if(operation==='identity')return [{result:{ok:true,account:'owner'}}];
  if(operation==='page-data')return response({});
  if(operation==='browse'&&payload.playlistId==='FEhistory'){if(historyFailure)return response({unexpected:true});return response({sectionListRenderer:{contents:[{itemSectionRenderer:{contents:[{videoRenderer:row(upload,'Previously watched video')},...(!payload.token?[{continuationItemRenderer:{continuationEndpoint:{continuationCommand:{token:'history-next'}}}}]:[])]}}]}});}
  if(operation==='browse'){const rows=playlists.get(payload.playlistId||'WL')||[];return response({playlistVideoListRenderer:{contents:rows.map(playlistVideoRenderer=>({playlistVideoRenderer}))},playlistHeaderRenderer:{numVideosText:{simpleText:`${rows.length} videos`}}});}
  if(operation==='playlists')return response({addToPlaylistRenderer:{playlists:[{playlistAddToOptionRenderer:{playlistId:'PL_TARGET',title:{simpleText:'Target playlist'},videoCount:playlists.get('PL_TARGET').length}}]}});
  if(operation==='channel-search')return response({contents:{twoColumnSearchResultsRenderer:{primaryContents:{channelRenderer:{channelId:B,title:{simpleText:'Another channel'}}}}}});
  if(operation==='channel-browse'){
   if(!payload.params)return response({contents:{twoColumnBrowseResultsRenderer:{tabs:[{tabRenderer:{title:'Videos',endpoint:{browseEndpoint:{browseId:payload.channelId,params:'returned-videos-tab'}}}}]}}});
   return response({contents:{twoColumnBrowseResultsRenderer:{tabs:[{tabRenderer:{selected:true,content:{videoRenderer:{videoId:upload,title:{simpleText:'Fresh upload'},publishedTimeText:{simpleText:'1 day ago'}}}}}]}}});
  }
  if(['restore','add-to-playlist'].includes(operation)){const list=playlists.get(payload.playlistId)||[];for(const id of payload.ids)list.push({...originals.get(id)||row(id,'Fresh upload'),setVideoId:`${payload.playlistId}-${id}`});playlists.set(payload.playlistId,list);return response({status:'STATUS_SUCCEEDED'});}
  if(operation==='remove'){playlists.set(payload.playlistId,playlists.get(payload.playlistId).filter(v=>!payload.ids.includes(v.setVideoId)));return response({status:'STATUS_SUCCEEDED'});}
  throw new Error(`Unexpected operation ${operation}`);
 }}};
 const $=id=>document.getElementById(id),click=selector=>{const b=document.querySelector(selector);assert.ok(b,selector);assert.equal(!!b.disabled,false,selector+' enabled');b.click();};
 const until=async(fn,label)=>{for(let i=0;i<300;i++){if(fn())return;await tick();}throw new Error(label+'; status: '+$('status').textContent);};
 const input=(id,text)=>{$(id).value=text;$(id).dispatchEvent(new window.Event('input',{bubbles:true}));};
 const submit=selector=>document.querySelector(selector).dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 try{
  await import('../app.js');await until(()=>$('connection').textContent.startsWith('Connected'),'connect');await $('load').onclick();
  assert.match($('matches').textContent,/2 loaded/);input('watch-later-cleaner-search','race');assert.match($('matches').textContent,/1 matching/);input('watch-later-cleaner-search','race,');assert.match($('matches').textContent,/2 matching/);assert.equal($('search-pills').children.length,1);input('watch-later-cleaner-search','other');assert.match($('matches').textContent,/2 matching/);$('clear-search').onclick();
  assert.equal(document.querySelector('.build-version').textContent,'v0.2.4');
  $('availability').value='available';$('availability').onchange();assert.match($('matches').textContent,/2 matching/);assert.equal($('clear-filters').hidden,false);$('clear-filters').onclick();assert.equal($('availability').value,'all');
  $('watch-filter').value='complete';$('watch-filter').dispatchEvent(new window.Event('input'));assert.match($('matches').textContent,/0 matching/);$('clear-filters').onclick();
  $('search-help-open').onclick();assert.match(document.querySelector('dialog[open]')?.textContent||document.querySelector('#workspace-dialog')?.textContent||document.body.textContent,/Find exactly what you want/);
  document.querySelectorAll('dialog').forEach(d=>{if(d.open)d.close();});
  $('select').onclick();assert.equal($('selected-view').hidden,false);$('selected-view').onclick();assert.equal($('selected-dialog').open,true);assert.equal($('selected-rows').children.length,2);$('selected-clear').onclick();assert.equal($('selected-view').hidden,true);$('selected-dialog').close();
  click('[data-view="feeds"]');assert.equal($('feeds-view').hidden,false);click('[data-ui="category-chip"][data-id="sport"]');click('[data-ui="category-chip"][data-id="f1"]');click('[data-ui="refresh-feed"]');await until(()=>document.querySelector('.feed-video'),'feed load');await until(()=>!$('stop').disabled===false,'feed finished');assert.match($('feeds-view').textContent,/Fresh upload/);assert.equal(document.querySelectorAll('.feed-video').length,1);
  click('[data-ui="save-feed"]');document.querySelector('[data-form="save-feed"] [name="name"]').value='Sport feed';submit('[data-form="save-feed"]');await until(()=>cache['feeds:owner'].feeds.length===1,'saved feed');assert.deepEqual(cache['feeds:owner'].feeds[0].cats,['sport','f1']);
  click('[data-ui="search-channels"]');$('youtube-channel-query').value='Another';submit('[data-form="channel-search"]');await until(()=>document.querySelector('[data-ui="categorise-channel"][data-id="'+B+'"]'),'channel search');await until(()=>$('stop').disabled,'search finished');assert.ok(requests.some(r=>r.operation==='channel-search'&&r.query==='Another'));
  click('[data-ui="categorise-channel"][data-id="'+B+'"]');const cat=document.querySelector('[data-form="categorise"] [name="categories"]');cat.checked=true;submit('[data-form="categorise"]');await until(()=>cache['feeds:owner'].channels.some(c=>c.id===B&&c.added),'add channel');
  click('[data-view="watch"]');await tick();const firstMove=[...$('rows').querySelectorAll('button')].find(b=>b.textContent==='Move…');await firstMove.onclick();let check=$('move-playlists').querySelector('input');check.checked=true;check.onchange();click('#transfer-toggle');assert.equal($('transfer-menu').hidden,false);click('[data-transfer="copy"]');assert.match($('move-confirm').textContent,/Copy 1 video/);await $('move-confirm').onclick();assert.equal(playlists.get('WL').length,2);assert.equal(playlists.get('PL_TARGET').length,1);assert.equal((cache['history:owner']||[]).length,0);
  click('[data-view="playlists"]');await tick();click('[data-ui="open-playlist"][data-id="PL_TARGET"]');await until(()=>$('current-playlist-title').textContent==='Target playlist'&&$('stop').disabled,'open target');assert.match($('matches').textContent,/1 loaded/);
  const targetMove=[...$('rows').querySelectorAll('button')].find(b=>b.textContent==='Move…');await targetMove.onclick();check=$('move-playlists').querySelector('input[value="WL"]');check.checked=true;check.onchange();await $('move-confirm').onclick();assert.equal(playlists.get('PL_TARGET').length,0);assert.equal(playlists.get('WL').length,2,'existing destination video is not duplicated');assert.equal(cache['history:owner'][0].sourceId,'PL_TARGET');
  click('[data-view="history"]');const restore=$('history-rows').querySelector('button');await restore.onclick();assert.equal(playlists.get('PL_TARGET').length,1);assert.ok(cache['history:owner'][0].restoredAt);assert.equal($('recover-details').hidden,true);
  // Filtering history must never discard records during a source refresh.
  $('history-search').value='does not match';$('history-search').oninput();await $('load').onclick();assert.equal(cache['history:owner'].length,1);
  const beforeImport=requests.length,exported=structuredClone(cache['history:owner']);
  $('history-import-file').files=[{size:1000,text:async()=>JSON.stringify({history:exported})}];await $('history-import-file').onchange();
  assert.equal(cache['history:owner'].length,1);assert.ok(cache['history:owner'][0].restoredAt);assert.equal(requests.length,beforeImport,'history import makes no YouTube requests');
  // Inline channel tags commit without replacing the active row or next input.
  click('[data-view="feeds"]');click('[data-ui="channels-tab"]');
  const tagInput=document.querySelector('[data-channel-tags="'+B+'"]');assert.ok(tagInput);
  tagInput.value='Cooking,food';tagInput.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(tagInput.value,'food');assert.equal(document.querySelector('[data-channel-tags="'+B+'"]'),tagInput);
  const enter=new window.Event('keydown',{bubbles:true,cancelable:true});enter.key='Enter';tagInput.dispatchEvent(enter);assert.equal(enter.defaultPrevented,true);assert.equal(tagInput.value,'');
  tagInput.value='True crime';tagInput.dispatchEvent(new window.Event('focusout',{bubbles:true}));
  await until(()=>cache['feeds:owner'].categories.some(c=>c.name==='True crime'),'blur saved');
  const savedLib=cache['feeds:owner'];for(const name of ['Cooking','food','True crime']){const cat=savedLib.categories.find(c=>c.name===name);assert.ok(savedLib.channels.find(c=>c.id===B).cats.includes(cat.id));assert.ok(savedLib.feeds.some(f=>f.autoCategoryId===cat.id));}
  tagInput.value=' cooking,';tagInput.dispatchEvent(new window.Event('input',{bubbles:true}));await tick();assert.equal(cache['feeds:owner'].categories.filter(c=>c.name.toLowerCase()==='cooking').length,1);
  const cookingId=savedLib.categories.find(c=>c.name==='Cooking').id;
  click('[data-ui="remove-channel-tag"][data-id="'+B+'"][data-tag="'+cookingId+'"]');await until(()=>!cache['feeds:owner'].channels.find(c=>c.id===B).cats.includes(cookingId),'remove inline tag');assert.ok(cache['feeds:owner'].feeds.some(f=>f.autoCategoryId===cookingId),'removing a channel tag keeps the reusable feed');
  click('[data-ui="feed-tab"]');const crime=cache['feeds:owner'].feeds.find(f=>f.name==='True crime');click('[data-ui="saved-feed"][data-id="'+crime.id+'"]');assert.match(document.querySelector('.feed-title').textContent,/True crime/);assert.match($('feeds-view').textContent,/1 channels/);

  click('[data-view="playlists"]');await tick();
  assert.equal(document.querySelector('[data-ui="delete-playlist"][data-id="FEhistory"]'),null);
  click('[data-ui="open-playlist"][data-id="FEhistory"]');
  await until(()=>$('current-playlist-title').textContent==='History'&&$('stop').disabled,'load YouTube history');
  assert.match($('matches').textContent,/1 loaded/);assert.equal($('watch-history-note').hidden,false);
  assert.ok(requests.some(r=>r.playlistId==='FEhistory'&&r.token==='history-next'));
  assert.equal(cache['playlist:owner:FEhistory'].videos[0].setVideoId,'');
  input('watch-later-cleaner-search','Previously');assert.match($('matches').textContent,/1 matching/);
  $('select').onclick();assert.equal($('remove').hidden,true);assert.equal($('move').textContent,'Copy…');assert.equal($('move').disabled,false);
  $('selected-view').onclick();assert.equal($('selected-remove').hidden,true);$('selected-dialog').close();
  const historyCount=cache['history:owner'].length;
  await $('move').onclick();assert.equal($('transfer-toggle').hidden,true);assert.equal($('move-playlists').querySelector('input[value="FEhistory"]'),null);
  check=$('move-playlists').querySelector('input[value="PL_TARGET"]');check.checked=true;check.onchange();
  await $('move-confirm').onclick();assert.ok(playlists.get('PL_TARGET').some(v=>v.videoId===upload));
  assert.equal(cache['playlist:owner:FEhistory'].videos.length,1);assert.equal(cache['history:owner'].length,historyCount);
  assert.equal(requests.some(r=>r.playlistId==='FEhistory'&&['remove','restore','add-to-playlist','delete-playlist'].includes(r.operation)),false);
  historyFailure=true;await $('load').onclick();assert.match($('status').textContent,/unfamiliar History format/);assert.equal(cache['playlist:owner:FEhistory'].videos.length,1);
  click('[data-view="watch"]');await tick();assert.equal($('current-playlist-title').textContent,'Watch Later');assert.equal($('watch-history-note').hidden,true);
 }finally{globalThis.FormData=originalForm;}
});
