// DOM and Chrome API doubles exercise app state transitions; not a live-browser test.
import test from 'node:test';
import assert from 'node:assert/strict';
class Element {
  constructor(){ this.style={};this.children=[];this.listeners={};this.value='';this.checked=false;this.disabled=false;this.textContent='';this.classList={toggle(){}}; }
  append(...children){this.children.push(...children)}
  replaceChildren(...children){this.children=children}
  setAttribute(){}
  removeAttribute(){}
  before(){}
  querySelector(){return new Element()}
  querySelectorAll(){return []}
  addEventListener(event,handler){this.listeners[event]=handler}
  focus(options){this.focused=true;this.focusOptions=options}
  showModal(){this.open=true}
  close(){this.open=false}
}
test('full workflow: pagination, 500/214 batches and live YouTube totals, cache, unconfirmed batch, refresh and stop',async()=>{
  const elements=new Map();
  const $=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
  globalThis.document={getElementById:$,createElement:()=>new Element(),querySelector:()=>new Element(),querySelectorAll:()=>[],addEventListener(){},dispatchEvent(){}};
  globalThis.window={addEventListener(){},requestAnimationFrame:fn=>fn(),scrollTo(){throw new Error('Unexpected forced scroll')}};
  globalThis.confirm=()=>{throw new Error('Unexpected confirmation')};
  Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:{request:async(name,options,fn)=>fn({})}});
  $('field').value='both';
  const cache={};const requests=[];let failure=false;let stopAfterFirst=false;let missingTotal=false;
  let videos=Array.from({length:732},(_,i)=>({setVideoId:`entry-${i}`,videoId:`video-${i}`,title:{simpleText:i<714?`Mearsheimer ${i}`:`Other ${i}`},shortBylineText:{simpleText:'Example'}}));
  let pickerFailure=false,countProbe=false;
  let deleteMode='success';const deletedPlaylists=new Set();
  const destination=[];const otherDestinations=new Map();let failedDestination=null;
  const destinationFor=id=>id==='PL_DEST'?destination:(otherDestinations.has(id)?otherDestinations.get(id):(otherDestinations.set(id,[]),otherDestinations.get(id))); 
  const originals = new Map(videos.map(v=>[v.videoId,v]));
  globalThis.chrome={storage:{local:{get:async key=>structuredClone(key===null?cache:Array.isArray(key)?Object.fromEntries(key.map(k=>[k,cache[k]])):{[key]:cache[key]}),set:async data=>Object.assign(cache,structuredClone(data)),remove:async key=>delete cache[key]}},tabs:{query:async()=>[{id:1,url:'https://www.youtube.com/playlist?list=WL'}]},scripting:{executeScript:async({args:[operation,payload]})=>{
    if(operation==='identity')return [{result:{ok:true,account:'account-A'}}];
    requests.push({operation,...payload});
    if(operation==='playlists'&&(!payload.videoId||pickerFailure))return [{result:{ok:false,error:'YouTube returned HTTP 400.'}}];
    if(operation==='playlists')return [{result:{ok:true,data:{addToPlaylistRenderer:{playlists:[{playlistAddToOptionRenderer:{playlistId:'PL_DEST',videoCount:destination.length,title:{simpleText:'Destination'}}},...requests.filter(r=>r.operation==='create-playlist').map((r,i)=>({playlistAddToOptionRenderer:{playlistId:'PL_NEW_'+(i+1),videoCount:countProbe?undefined:destinationFor('PL_NEW_'+(i+1)).length,title:{simpleText:r.title}}}))].filter(p=>!deletedPlaylists.has(p.playlistAddToOptionRenderer.playlistId))}}}}];
    if(operation==='delete-playlist'){
     if(deleteMode==='fail')return [{result:{ok:false,error:'HTTP 403'}}];
     if(deleteMode!=='unconfirmed')deletedPlaylists.add(payload.playlistId);
     return [{result:{ok:true,data:{responseContext:{}}}}];
    }
    if(operation==='create-playlist')return [{result:{ok:true,data:{playlistId:'PL_NEW_'+requests.filter(r=>r.operation==='create-playlist').length}}}];
    if(operation==='add-to-playlist'){
      if(payload.playlistId===failedDestination)return [{result:{ok:true,data:{status:'STATUS_FAILED'}}}];
      destinationFor(payload.playlistId).push(...videos.filter(v=>payload.ids.includes(v.videoId)).map(v=>({...v,setVideoId:`dest-${v.videoId}`})));
      return [{result:{ok:true,data:{status:'STATUS_SUCCEEDED'}}}];
    }
    if(operation==='browse'&&payload.playlistId&&payload.playlistId!=='WL'&&!destinationFor(payload.playlistId).length)return [{result:{ok:true,data:{contents:{twoColumnBrowseResultsRenderer:{tabs:[{tabRenderer:{selected:true,content:{sectionListRenderer:{contents:[{messageRenderer:{text:{simpleText:'This playlist has no videos.'}}}]}}}}]}}}}}];
    if(operation==='browse'&&payload.playlistId&&payload.playlistId!=='WL')return [{result:{ok:true,data:{...(countProbe?{playlistHeaderRenderer:{numVideosText:{simpleText:`${destinationFor(payload.playlistId).length} videos`}}}:{}),playlistVideoListRenderer:{contents:destinationFor(payload.playlistId).map(playlistVideoRenderer=>({playlistVideoRenderer}))}}}}];
    if(operation==='restore'){
      for(const id of payload.ids)videos.push({...originals.get(id),setVideoId:`restored-${id}`});
      return [{result:{ok:true,data:{status:'STATUS_SUCCEEDED'}}}];
    }
    if(operation==='remove'){
      if(failure)return [{result:{ok:true,data:{status:'STATUS_FAILED'}}}];
      videos=videos.filter(v=>!payload.ids.includes(v.setVideoId));
      return [{result:{ok:true,data:{status:'STATUS_SUCCEEDED'}}}];
    }
    const offset=Number(payload.token||0);
    const entries=videos.slice(offset,offset+100).map(playlistVideoRenderer=>({playlistVideoRenderer}));
    if(offset+100<videos.length)entries.push({continuationItemRenderer:{continuationEndpoint:{continuationCommand:{token:String(offset+100)}}}});
    if(stopAfterFirst)$('stop').onclick();
    return [{result:{ok:true,data:payload.token?{appendContinuationItemsAction:{continuationItems:entries}}:{playlistVideoListRenderer:{contents:entries},...(missingTotal?{}:{playlistHeaderRenderer:{numVideosText:{simpleText:`${4077+videos.length} videos`}}})}}}];
  }}};
  await import('../app.js');
  for(let i=0;i<20&&!$('connection').textContent.startsWith('Connected');i++)await new Promise(r=>setImmediate(r));
  assert.match($('connection').textContent,/Connected/);
  await $('manage-playlists').onclick();
  assert.equal($('move-confirm').hidden,true);
  assert.equal($('move-explanation').hidden,true);
  assert.equal($('move-playlists').children[0].children[0].children[1].textContent,'Destination');
  $('move-cancel').onclick();
  await $('load').onclick();
  assert.match($('matches').textContent,/732 loaded/);
  assert.equal($('youtube-total').textContent,'4,809');
  assert.equal($('free-slots').textContent,'191');
  assert.deepEqual(requests.filter(r=>r.operation==='browse').map(r=>r.token),[undefined,undefined,undefined,'100','200','300','400','500','600','700']);
  $('watch-later-cleaner-search').value='mears';$('watch-later-cleaner-search').listeners.input();
  assert.match($('matches').textContent,/714 matching/);
  assert.equal($('search-pills').children.length,0);
  assert.equal($('rows').children[0].children[0].children[0].textContent,'1');
  $('watch-later-cleaner-search').value='mearsheimer,other';$('watch-later-cleaner-search').listeners.input();
  assert.equal($('search-pills').children.length,1);assert.match($('matches').textContent,/732 matching/);
  $('watch-later-cleaner-search').listeners.keydown({key:'Enter',preventDefault(){}});
  assert.equal($('search-pills').children.length,2);assert.match($('matches').textContent,/732 matching/);
  const findButton = element => element.textContent === 'All from this channel' ? element : element.children.map(findButton).find(Boolean);
  findButton($('rows')).onclick();
  assert.equal($('channel-scope').hidden,false);
  assert.equal($('watch-later-cleaner-search').value,'');
  assert.match($('matches').textContent,/732 matching/);
  $('clear-channel').onclick();assert.equal($('channel-scope').hidden,true);
  $('watch-later-cleaner-search').value='mearsheimer';$('watch-later-cleaner-search').listeners.input();$('select').onclick();
  assert.match($('selected').textContent,/714 selected/);
  $('selected-view').onclick();assert.match($('selected-heading').textContent,/714/);
  assert.equal($('selected-rows').children.length,100);
  $('watch-later-cleaner-search').value='other';$('watch-later-cleaner-search').listeners.input();
  assert.match($('selected-heading').textContent,/714/);
  assert.equal($('select-all-checkbox').checked,false);
  $('select-all-checkbox').checked=true;$('select-all-checkbox').onchange();
  assert.match($('selected').textContent,/732 selected/);
  $('select-all-checkbox').checked=false;$('select-all-checkbox').onchange();
  assert.match($('selected').textContent,/714 selected/);
  $('selected-rows').children[0].children[0].onchange();
  assert.match($('selected').textContent,/713 selected/);
  $('watch-later-cleaner-search').value='mearsheimer';$('watch-later-cleaner-search').listeners.input();
  assert.equal($('select-all-checkbox').indeterminate,true);
  $('select-all-checkbox').checked=true;$('select-all-checkbox').onchange();
  assert.match($('selected').textContent,/714 selected/);
  $('next-top').onclick();assert.match($('pageinfo').textContent,/101–200/);
  assert.equal($('pageinfo').textContent,$('pageinfo-top').textContent);
  assert.equal($('next').disabled,false);assert.equal($('next-top').disabled,false);
  $('prev-top').onclick();$('selected-close').onclick();

  $('remove').onclick();assert.equal($('review-list').children.length,714);
  await $('confirm').onclick();
  assert.deepEqual(requests.filter(r=>r.operation==='remove').map(r=>r.ids.length),[500,214]);
  for(let i=0;i<requests.length;i++)if(requests[i].operation==='remove')assert.equal(requests[i+1]?.operation,'browse');
  assert.equal($('youtube-total').textContent,'4,095');
  assert.equal($('free-slots').textContent,'905');
  missingTotal=true;await $('refresh-count').onclick();
  assert.equal($('youtube-total').textContent,'4,095');
  assert.match($('count-status').textContent,/Last known count/);
  missingTotal=false;await $('refresh-count').onclick();
  assert.match($('count-status').textContent,/Checked with YouTube/);
  assert.equal(cache['playlist:account-A'].videos.length,18);
  assert.equal($('watch-later-cleaner-search').value,'');
  assert.equal($('watch-later-cleaner-search').focused,true);
  assert.deepEqual($('watch-later-cleaner-search').focusOptions,{preventScroll:true});
  assert.equal($('review').open,false);
  assert.equal(cache['playlist:account-A'].pending,null);
  $('watch-later-cleaner-search').value='';$('watch-later-cleaner-search').listeners.input();
  await $('connect').onclick();assert.match($('matches').textContent,/18 loaded/);
  failure=true;$('select').onclick();$('remove').onclick();await $('confirm').onclick();
  assert.equal(cache['playlist:account-A'].videos.length,18);
  assert.equal(cache['playlist:account-A'].pending,null);
  assert.equal($('remove').disabled,false);
  cache['playlist:account-A'].pending={kind:'remove',ids:[],videos:[],started:Date.now()};
  await $('connect').onclick();assert.equal(cache['playlist:account-A'].pending,null);
  assert.match($('status').textContent,/Recovery complete/);
  failure=false;await $('load').onclick();assert.equal(cache['playlist:account-A'].pending,null);
  // Extend fixture and stop a scan before its continuation; removal must remain disabled.
  videos=Array.from({length:150},(_,i)=>({setVideoId:`new-${i}`,videoId:`v-${i}`,title:{simpleText:'Title'}}));
  stopAfterFirst=true;await $('load').onclick();
  assert.equal(cache['playlist:account-A'].complete,false);
  assert.equal(cache['playlist:account-A'].videos.length,100);
  $('select').onclick();assert.equal($('remove').disabled,true);
  assert.equal(cache['playlist:account-A'].history.length,714);
  // Restore two selected history entries, one of which was already re-added elsewhere.
  stopAfterFirst=false;
  const firstHistory=cache['playlist:account-A'].history[0];
  videos.push({...originals.get(firstHistory.video.videoId),setVideoId:'already-present'});
  const historyRows=$('history-rows').children;
  for(const row of historyRows.slice(0,2)){row.children[0].checked=true;row.children[0].onchange();}
  await $('history-restore-selected').onclick();
  const restoreRequests=requests.filter(r=>r.operation==='restore');
  assert.equal(restoreRequests.length,1);assert.equal(restoreRequests[0].ids.length,1);
  assert.equal(cache['playlist:account-A'].history.filter(h=>h.restoredAt).length,2);
  assert.equal(cache['playlist:account-A'].complete,true);
  // Per-row Remove bypasses confirmation and creates a new history record.
  const findRemove=element=>element.textContent==='Remove'?element:element.children.map(findRemove).find(Boolean);
  $('watch-later-cleaner-search').value='Title';$('watch-later-cleaner-search').listeners.input();
  const oldCount=cache['playlist:account-A'].history.length;
  await findRemove($('rows')).onclick();
  assert.equal(cache['playlist:account-A'].history.length,oldCount+1);
  assert.equal($('watch-later-cleaner-search').value,'Title');
  assert.equal($('search-again').hidden,false);$('search-again').onclick();
  assert.equal($('watch-later-cleaner-search').value,'');
  // Click first result, Shift-click seventh: inclusive selection without scroll.
  const firstCheck=$('rows').children[0].children[0].children[1];firstCheck.checked=true;firstCheck.listeners.click({shiftKey:false});
  const seventhCheck=$('rows').children[6].children[0].children[1];seventhCheck.checked=true;seventhCheck.listeners.click({shiftKey:true});
  assert.match($('selected').textContent,/7 selected/);
  $('watch-later-cleaner-search').value='no matches';$('watch-later-cleaner-search').listeners.input();
  $('clear-search').onclick();assert.match($('selected').textContent,/7 selected/);
  const findMove=element=>element.textContent==='Move…'?element:element.children.map(findMove).find(Boolean);
  function selectFirstDestination(){
   assert.equal($('move-confirm').disabled,true,'Fresh move requires an explicit destination');
   for(const row of $('move-playlists').children)assert.equal(row.children[0].children[0].checked,false,'No previous destination retained');
   const checkbox=$('move-playlists').children[0].children[0].children[0];checkbox.checked=true;checkbox.onchange();
   assert.equal($('move-confirm').disabled,false);
  }
  let sourceCount=videos.length;
  await findMove($('rows')).onclick();selectFirstDestination();
  $('move-cancel').onclick();
  await findMove($('rows')).onclick();selectFirstDestination();
  assert.equal($('move-target').value,'PL_DEST');
  assert.equal($('move-playlists').children[0].children[0].children[1].textContent,'Destination');
  $('move-search').value='no such playlist';$('move-search').listeners.input();
  assert.match($('move-playlists').children[0].textContent,/No matching playlists/);
  $('move-search').value='';$('move-search').listeners.input();
  await $('move-confirm').onclick();
  assert.equal(destination.length,1);assert.equal(videos.length,sourceCount-1);
  assert.match(cache['playlist:account-A'].history[0].outcome,/Moved to Destination/);
  await findMove($('rows')).onclick();selectFirstDestination();$('move-new').onclick();
  assert.equal($('move-existing-wrap').hidden,true);assert.equal($('move-name-wrap').hidden,false);
  assert.equal($('move-confirm').textContent,'Create playlist & move videos');
  assert.equal($('move-create-only').hidden,false);
  const beforeCreate=requests.length;
  const beforeSelection=$('selected').textContent;
  await $('move-create-only').onclick();
  assert.equal(requests.length,beforeCreate); // Empty name makes no request.
  $('move-name').value='Create without moving';
  let prevented=false;
  await $('move-name').listeners.keydown({key:'Enter',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.deepEqual(requests.slice(beforeCreate).map(r=>r.operation),['create-playlist']);
  assert.equal(videos.length,sourceCount-1);
  assert.equal(destination.length,1);
  assert.equal($('selected').textContent,beforeSelection);
  assert.equal($('move-dialog').open,true);
  assert.equal($('move-target').value,'PL_NEW_1');
  assert.equal($('move-existing-wrap').hidden,false);
  assert.equal($('move-name-wrap').hidden,true);
  assert.equal($('move-create-only').hidden,true);
  assert.equal($('move-playlists').children[0].children[0].children[0].checked,true);
  assert.equal($('move-playlists').children[0].children[0].children[1].textContent,'Create without moving');
  assert.equal($('move-playlists').children[0].children[0].children[2].textContent,'0 videos');
  assert.equal($('move-confirm').textContent,'Move 1 video');
  for(const row of $('move-playlists').children){
   assert.equal(row.children[0].children[0].disabled,false,'Destination checkbox re-enabled after creation');
   assert.equal(row.children[1].children[1].disabled,false,'Delete re-enabled after creation');
  }
  $('move-playlists').children[0].children[1].children[1].onclick();
  assert.equal($('delete-playlist-dialog').open,true);
  assert.equal($('delete-playlist-name').textContent,'Create without moving');
  $('delete-playlist-cancel').onclick();
  // Checkbox selection survives filtering, then create-and-move includes all selected destinations.
  assert.equal($('move-playlists').children[0].children[0].children[0].type,'checkbox');
  $('move-search').value='Destination';$('move-search').listeners.input();
  const existingCheck=$('move-playlists').children[0].children[0].children[0];
  existingCheck.checked=false;existingCheck.onchange();
  existingCheck.checked=true;existingCheck.onchange();
  $('move-new').onclick();
  assert.equal($('move-name').value,'','New playlist starts with a blank name');
  const multiStart=requests.length;
  $('move-name').value='New private playlist';
  await $('move-confirm').onclick();
  assert.equal(destination.length,2);assert.equal(videos.length,sourceCount-2);
  assert.ok(requests.some(r=>r.operation==='create-playlist'&&r.title==='New private playlist'));
  assert.equal(destinationFor('PL_NEW_1').length,1);
  assert.equal(destinationFor('PL_NEW_2').length,1);
  const multi=requests.slice(multiStart);
  const removeIndex=multi.findIndex(r=>r.operation==='remove');
  for(const id of ['PL_DEST','PL_NEW_1','PL_NEW_2']){
   const addIndex=multi.findIndex(r=>r.operation==='add-to-playlist'&&r.playlistId===id);
   assert.ok(addIndex>=0&&addIndex<removeIndex);
   assert.ok(multi.slice(addIndex+1,removeIndex).some(r=>r.operation==='browse'&&r.playlistId===id));
  }
  // Failure in the second destination must keep the source, even after the first copy succeeded.
  await findMove($('rows')).onclick();selectFirstDestination();$('move-new').onclick();
  $('move-name').value='Failing destination';await $('move-create-only').onclick();
  failedDestination='PL_NEW_3';
  const failureStart=requests.length,remaining=videos.length;
  await $('move-confirm').onclick();
  assert.equal(videos.length,remaining);
  assert.equal(requests.slice(failureStart).some(r=>r.operation==='remove'),false);
  assert.equal(cache['playlist:account-A'].pending,null);
  cache['playlist:account-A'].pending={kind:'move',phase:'adding',videos:[],started:Date.now()};
  await $('connect').onclick();assert.equal(cache['playlist:account-A'].pending,null);
  assert.match($('status').textContent,/Recovered interrupted copy/);
  // Failure must not leave move controls visible or stale playlist entries.
  pickerFailure=true;await $('manage-playlists').onclick();
  assert.equal($('move-confirm').hidden,true);assert.equal($('move-explanation').hidden,true);
  assert.match($('move-status').textContent,/HTTP 400/);
  assert.equal($('move-new').disabled,false);
  assert.match($('move-playlists').children[0].textContent,/could not be loaded/);
  $('move-cancel').onclick();pickerFailure=false;
  // Manage without video selection; cancellation, rejected/uncertain deletion, then exact-ID success.
  await $('manage-playlists').onclick();
  assert.equal($('move-heading').textContent,'Manage playlists');
  assert.equal($('move-confirm').hidden,true);
  const findDelete=()=> $('move-playlists').children[0].children[1].children[1];
  const beforeDelete=requests.length;
  findDelete().onclick();assert.equal($('delete-playlist-name').textContent,'Destination');
  $('delete-playlist-cancel').onclick();assert.equal(requests.length,beforeDelete);
  deleteMode='fail';findDelete().onclick();await $('delete-playlist-confirm').onclick();
  assert.equal($('delete-playlist-dialog').open,true);assert.match($('delete-playlist-status').textContent,/could not be verified/);
  assert.equal($('delete-playlist-confirm').disabled,true);
  $('delete-playlist-cancel').onclick();
  deleteMode='unconfirmed';findDelete().onclick();await $('delete-playlist-confirm').onclick();
  assert.match($('delete-playlist-status').textContent,/still appears/);$('delete-playlist-cancel').onclick();
  deleteMode='success';findDelete().onclick();await $('delete-playlist-confirm').onclick();
  assert.equal($('delete-playlist-dialog').open,false);
  assert.equal($('move-playlists').children.some(row=>row.children[0].children[0].value==='PL_DEST'),false);
  assert.match($('move-destination-count').textContent,/0 playlists selected/);
  assert.equal(videos.length,remaining);
  assert.ok(requests.slice(beforeDelete).filter(r=>r.operation==='delete-playlist').every(r=>r.playlistId==='PL_DEST'));
  assert.equal(requests.slice(beforeDelete).some(r=>['remove','add-to-playlist','restore'].includes(r.operation)),false);
  countProbe=true;
  await $('manage-playlists').onclick();
  for(let i=0;i<20&&$('move-playlists').children.some(row=>row.children[0].children[2].textContent==='Loading count…');i++)await new Promise(r=>setImmediate(r));
  assert.equal($('move-playlists').children[0].children[0].children[2].textContent,'1 video');
  assert.equal($('move-playlists').children.at(-1).children[0].children[2].textContent,'0 videos');
  // Bulk recovery records row failures, continues, and preserves outcomes after reload.
  videos=[{setVideoId:'unavailable-a',videoId:'c6f6zstXGbo',title:{simpleText:'Deleted video'},isPlayable:false},{setVideoId:'unavailable-b',videoId:'xvHVjnGMYL4',title:{simpleText:'Private video'},isPlayable:false}];
  await $('load').onclick();
  chrome.permissions={request:async()=>true};
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async url=>{
   if(url.includes('/oembed'))return {ok:false,status:404};
   if(url.includes('c6f6zstXGbo'))return {ok:false,status:503};
   return {ok:true,json:async()=>[]};
  };
  try{
   await $('recover-all-details').onclick();
   assert.equal($('recovery-count').textContent,'Finished: 2/2 checked · 0 recovered · 1 unavailable · 1 failed');
   assert.equal(cache['playlist:account-A'].recoveryAttempts.c6f6zstXGbo.status,'error');
   assert.equal(cache['playlist:account-A'].recoveryAttempts.xvHVjnGMYL4.status,'not_found');
   const hasText=(element,pattern)=>pattern.test(element.textContent)||element.children.some(c=>hasText(c,pattern));
   assert.ok(hasText($('rows'),/Recovery failed:/));
   assert.ok(hasText($('rows'),/No recoverable details found/));
   await $('load').onclick();
   assert.ok(hasText($('rows'),/Recovery failed:/));
   globalThis.fetch=async()=>({ok:true,json:async()=>({title:'Recovered title',author_name:'Channel'})});
   const findRetry=element=>element.textContent==='Retry recovery'?element:element.children.map(findRetry).find(Boolean);
   await findRetry($('rows')).onclick();
   assert.equal($('recovery-count').textContent,'Finished: 1/1 checked · 1 recovered · 0 unavailable');
   assert.equal(cache['playlist:account-A'].recoveryAttempts.c6f6zstXGbo,undefined);
   assert.equal(cache['playlist:account-A'].videos[0].title,'Recovered title');
   assert.equal(cache['playlist:account-A'].videos[0].unavailable,true);
   await findRemove($('rows')).onclick();
   const removed=cache['playlist:account-A'].history[0];
   assert.equal(removed.video.title,'Recovered title');assert.equal(removed.video.channel,'Channel');
   assert.equal(removed.video.recovered.source,'youtube');
   await $('connect').onclick();
   assert.ok(hasText($('history-rows'),/Recovered title/));
   assert.ok(hasText($('history-rows'),/Recovered details/));
  }finally{globalThis.fetch=oldFetch;}

});
