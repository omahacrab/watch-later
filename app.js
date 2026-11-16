import {initWorkspace} from './workspace.js';
import {recoverDetails,applyRecovered,recoverHistoryDetails} from './recovery.js';
import {firstResultScrollTarget} from './scroll-position.js';
import {playlistOptions,sortVideos} from './list-options.js';
import {editablePlaylists,emptyDestination,playlistStructure,verifyDestinationVideos} from './playlists.js';
import {splitPills,watchMatches} from './search-pills.js';
import {selectRange} from './selection.js';
import {channelIndex, channelsFor, sharesChannel} from './channels.js';
import {extractPlaylistTotal, capacity} from './counts.js';
import {BATCH_SIZE, parsePlaylist, mergeEntries, filterEntries, parseSearch, batches, confirmRemoval, mergeRemovalHistory} from './core.js';
import {youtubeRequest} from './youtube.js';
const $ = id => document.getElementById(id);
let sourceId='WL',sourceTitle='Watch Later',searchPaused=false,transferMode='move',preferredTabId=null,recentRemovalIds=[];
let tabId, account, state = {videos: [], complete: false, updated: null, pending: null};
let selected = new Set(), page = 0, busy = false, stopped = false, connecting = false;
let channelFilter = null;
let selectedPage = 0;
let searchPills = [];
let nativeSort = null;
let moveItems = [], destinations = [];
let moveDestinationIds = new Set();
let playlistCountGeneration=0;
let recoveryController=null;
const playlistCountLabels=new Map();
let managingPlaylists=false,deleteTarget=null;
let selectionAnchor = null, historyPage = 0;
const historySelected = new Set();
const PAGE_SIZE = 100;
function recordTotal(value, source) {
  if (value === null) return false;
  state.youtubeCount = {value, checkedAt: Date.now(), source, stale: false};
  return true;
}
async function refreshTotal() {
  try {
    const result = await call('browse');
    const value = extractPlaylistTotal(result.data);
    if (!recordTotal(value, 'YouTube response')) throw new Error('Count missing from YouTube response');
  } catch {
    if (state.youtubeCount) state.youtubeCount.stale = true;
  }
  await save(); render();
}
const storageKey = () => sourceId==='WL'?`playlist:${account}`:`playlist:${account}:${sourceId}`;
function message(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
async function save() { if(!account)return;const historyKey=`history:${account}`;const stored=(await chrome.storage.local.get(historyKey))[historyKey]||[];state.history=recoverHistoryDetails(mergeRemovalHistory(stored,state.history),state.recoveredMetadata); await chrome.storage.local.set({[storageKey()]: state,[historyKey]:state.history}); }
async function call(operation, payload = {}) {
  if (!tabId) throw new Error('Connect to YouTube first.');
  const results = await chrome.scripting.executeScript({target: {tabId}, world: 'MAIN', func: youtubeRequest, args: [operation, {playlistId:sourceId,...payload, ...(account ? {account} : {})}]});
  const result = results[0]?.result;
  if (!result?.ok) throw new Error(result?.error || 'YouTube tab is unavailable. Reconnect.');
  if(['add-to-playlist','restore','remove'].includes(operation)&&result.data?.status==='STATUS_SUCCEEDED'){
    document.dispatchEvent(new CustomEvent('playlist-mutated',{detail:{id:payload.playlistId||sourceId}}));
    const id=payload.playlistId||sourceId;
    if(id!==sourceId){const key=id==='WL'?`playlist:${account}`:`playlist:${account}:${id}`;const cached=(await chrome.storage.local.get(key))[key];if(cached){cached.complete=false;if(cached.youtubeCount)cached.youtubeCount.stale=true;await chrome.storage.local.set({[key]:cached});}}
  }
  return result;
}
function matchingUnsorted() {
 const index=channelIndex(state.videos);
 const scope=state.videos.filter(v=>(channelFilter===null || sharesChannel(v,channelFilter,index)) && ($('watch-filter').value==='range'?typeof v.watchedPercent==='number'&&v.watchedPercent>=Number($('played-min').value)&&v.watchedPercent<=Number($('played-max').value):watchMatches(v,$('watch-filter').value)));
 const terms=searchPaused?[]:[...searchPills,$('watch-later-cleaner-search').value.trim()].filter(Boolean);
 if(!terms.length)return filterEntries(scope,'',$('field').value,$('unavailable').checked);
 if(terms.some(t=>parseSearch(t).error))return [];
 const keys=new Set(terms.flatMap(term=>filterEntries(scope,term,$('field').value,$('unavailable').checked)).map(v=>v.key));
 return scope.filter(v=>keys.has(v.key));
}
function matching() { return sortVideos(matchingUnsorted(), $('sort').value); }
function renderPills(){
 $('search-pills').replaceChildren(...searchPills.map((term,index)=>{
  const pill=document.createElement('span');pill.className='search-pill';
  const label=document.createElement('span');label.textContent=term;
  const button=document.createElement('button');button.type='button';button.textContent='×';button.disabled=busy;
  button.setAttribute('aria-label',`Remove search ${term}`);
  button.onclick=()=>{searchPills.splice(index,1);selectionAnchor=null;page=0;render();};
  pill.append(label,button);return pill;
 }));
}

function render() {
  $('manage-playlists').disabled=busy||connecting||!account;
  const recoveryItems=recoveryCandidates().filter(v=>selected.has(v.key));
  const allRecoveryItems=recoveryCandidates(true);
  $('recover-all-details').textContent=`Recover all unavailable (${allRecoveryItems.length})`;
  $('recover-all-details').disabled=busy||connecting||!account||!allRecoveryItems.length;
  $('recover-details').textContent="Recover 'unavailable' info";
  $('recover-details').hidden=!state.videos.some(v=>v.unavailable&&selected.has(v.key));
  $('recover-all-details').hidden=true;
  $('played-range').hidden=$('watch-filter').value!=='range';
  $('current-playlist-title').textContent=sourceTitle;
  document.querySelector('.capacity-card').hidden=sourceId!=='WL';
  document.dispatchEvent(new Event('workspace-state'));
  $('recover-details').disabled=busy||connecting||!account||!recoveryItems.length;
  renderPills();
  $('sort').disabled=busy||connecting;
  $('clear-search').disabled=busy; $('search-again').disabled=busy;
  renderHistory();
  $('undo-last').hidden=!recentRemovalIds.some(id=>(state.history||[]).some(h=>h.historyId===id&&!h.restoredAt));
  $('undo-last').disabled=busy||!!state.pending;
  renderSelected();
  $('channel-scope').hidden = channelFilter === null;
  $('channel-scope-label').textContent = channelFilter === null ? '' : `${channelFilter.length > 1 ? 'Channels' : 'Channel'}: ${channelFilter.map(c => c.name).join(' · ')}`;
  $('clear-channel').disabled = busy;
  const count = state.youtubeCount;
  const summary = capacity(count?.value);
  $('youtube-total').textContent = summary ? summary.total.toLocaleString() : '—';
  $('free-slots').textContent = summary ? summary.free.toLocaleString() : '—';
  $('capacity-meter').value = summary?.total ?? 0;
  $('count-status').textContent = !count ? 'YouTube total not read yet' : `${count.stale ? 'Last known count; refresh needed' : count.source === 'YouTube page' ? 'Read from the open YouTube page' : 'Checked with YouTube'} · ${new Date(count.checkedAt).toLocaleTimeString()}`;
  $('refresh-count').disabled = busy || connecting || !account;
  const matches = matching();
  const searchError = searchPaused?null:[...searchPills,$('watch-later-cleaner-search').value].map(t=>parseSearch(t).error).find(Boolean);
  $('search-help').textContent = searchError || 'Comma saves an OR pill and shows all videos until you type again. Enter applies pills. Quotes keep commas inside phrases. Title/channel selector applies to all pills; title: and channel: override it.';
  $('watch-later-cleaner-search').setAttribute('aria-invalid', String(!!searchError));
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  page = Math.min(page, pages - 1);
  $('matches').textContent = `${matches.length.toLocaleString()} matching / ${state.videos.length.toLocaleString()} loaded`;
  const matchKeys = new Set(matches.map(v => v.key));
  const hidden = [...selected].filter(key => !matchKeys.has(key)).length;
  $('selected').textContent = ` · ${selected.size} selected${hidden ? ` (${hidden} outside this search)` : ''}`;
  $('snapshot').textContent = state.updated ? `${state.complete ? 'Scan finished' : 'Partial list'} · ${new Date(state.updated).toLocaleString()}` : 'No playlist loaded';
  $('load').disabled = busy || !account;
  $('connect').disabled = busy || connecting;
  $('connect').textContent = connecting ? 'Connecting…' : account ? 'Reconnect' : 'Connect';
  $('stop').disabled = !busy;
  $('export').disabled = !state.videos.length;
  $('forget').disabled = busy || !account;
  const selectable = matches.filter(v => v.setVideoId);
  const selectedMatches = selectable.filter(v => selected.has(v.key)).length;
  $('select-all-checkbox').checked = selectable.length > 0 && selectedMatches === selectable.length;
  $('select-all-checkbox').indeterminate = selectedMatches > 0 && selectedMatches < selectable.length;
  $('select-all-checkbox').disabled = busy || !selectable.length;
  $('selected-view').textContent = `Selected videos (${selected.size.toLocaleString()})`;
  $('selected-view').disabled = !selected.size;
  $('select').disabled = busy || !selectable.length;
  $('clear').disabled = busy || !selected.size;
  $('remove').disabled = busy || !selected.size || !state.complete || !!state.pending;
  $('move').disabled = $('remove').disabled;
  $('watch-later-cleaner-search').disabled = busy; $('field').disabled = busy; $('unavailable').disabled = busy; $('watch-filter').disabled = busy;
  $('prev').disabled = page === 0; $('next').disabled = page >= pages - 1;
  $('prev-top').disabled = $('prev').disabled; $('next-top').disabled = $('next').disabled;
  $('pageinfo').textContent = matches.length ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, matches.length)} of ${matches.length} · Select all includes every page` : '';
  $('pageinfo-top').textContent = $('pageinfo').textContent;
  const rows = $('rows'); rows.replaceChildren();
  if (!matches.length) {
    const empty = document.createElement('div'); empty.className = 'empty';
    const title = document.createElement('h2'); title.textContent = state.updated ? 'No matching videos' : 'Your playlist, easier to manage.';
    const p = document.createElement('p'); p.textContent = state.updated ? 'Try a different name or a shorter search.' : 'Connect to YouTube and load your playlist to get started.';
    empty.append(title, p); rows.append(empty);
  }
  const index = channelIndex(state.videos);
  for (const [offset,video] of matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).entries()) {
    const row = document.createElement('div'); row.className = `video-row${selected.has(video.key) ? ' chosen' : ''}`;
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = selected.has(video.key); check.disabled = busy || !video.setVideoId;
    check.setAttribute('aria-label', `Select ${video.title}`);
    check.addEventListener('click', event => {
      selectionAnchor = selectRange(selected, matches, selectionAnchor, video.key, event.shiftKey, check.checked);
      render();
    });
    const details = document.createElement('div'); details.className = 'video-details';
    const thumbnail = document.createElement('span'); thumbnail.className = 'video-thumbnail';
    thumbnail.setAttribute('aria-hidden', 'true');
    if (video.videoId && !video.unavailable) {
      const img = document.createElement('img');
      img.src = `https://i.ytimg.com/vi/${encodeURIComponent(video.videoId)}/mqdefault.jpg`;
      img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      img.width = 96; img.height = 54; img.referrerPolicy = 'no-referrer';
      img.onerror = () => { thumbnail.replaceChildren(); thumbnail.textContent = '▷'; };
      thumbnail.append(img);
    } else thumbnail.textContent = '▷';
    if(typeof video.watchedPercent==='number'){
      const progress=document.createElement('span');progress.className='watched-bar';progress.style.width=`${video.watchedPercent}%`;thumbnail.append(progress);
    }
    const description = document.createElement('div'); description.className = 'video-description';
    const title = document.createElement(video.videoId ? 'a' : 'strong'); title.textContent = video.title;
    if (video.videoId) { title.href = `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`; title.target = '_blank'; title.rel = 'noopener noreferrer'; }
    const subtitle = document.createElement('small'); subtitle.textContent = [video.channel, typeof video.watchedPercent==='number'?`${video.watchedPercent}% played`:'', video.unavailable ? 'Unavailable' : '', !video.setVideoId ? 'No removal ID supplied by YouTube' : ''].filter(Boolean).join(' · ');
    const channelLine = document.createElement('div'); channelLine.className = 'channel-line';
    const allFromChannel = document.createElement('button');
    allFromChannel.type = 'button'; allFromChannel.className = 'channel-action';
    const rowChannels = channelsFor(video, index);
    allFromChannel.textContent = rowChannels.length > 1 ? 'All from these channels' : 'All from this channel';
    allFromChannel.disabled = busy || !rowChannels.length;
    allFromChannel.setAttribute('aria-label', `${allFromChannel.textContent}: ${rowChannels.map(c => c.name).join(', ') || 'unavailable'}`);
    allFromChannel.onclick = () => {
      selectionAnchor = null; channelFilter = rowChannels;
      searchPills=[];searchPaused=false; $('watch-filter').value='all';
      $('watch-later-cleaner-search').value = '';
      $('field').value = 'both'; $('unavailable').checked = false;
      page = 0; render();
      message(`Showing ${matching().length} saved Watch Later videos from ${rowChannels.map(c => c.name).join(' or ')}.${state.channelMetadataVersion === 1 ? '' : ' Refresh the playlist once to collect channel IDs for more reliable matching.'}`);
      revealFirstChannelResult();

    };
    channelLine.append(subtitle, allFromChannel);
    if(video.recovered){
     const source=document.createElement('a');source.textContent=video.recovered.source==='archive'?'Archived details ↗':'Recovered details ↗';source.className='channel-action';source.title=video.recovered.archivedAt?`Archived ${video.recovered.archivedAt.slice(0,4)}-${video.recovered.archivedAt.slice(4,6)}-${video.recovered.archivedAt.slice(6,8)}`:'Metadata recovered from YouTube';source.href=video.recovered.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';channelLine.append(source);
    }
    description.append(title, channelLine);
    details.append(thumbnail, description);
    const duration = document.createElement('span'); duration.className = 'duration'; duration.textContent = video.duration || '—';
    const rowActions = document.createElement('div'); rowActions.className = 'row-actions';
    const removeOne = document.createElement('button'); removeOne.textContent = 'Remove'; removeOne.className = 'danger row-remove';
    removeOne.disabled = busy || !state.complete || !!state.pending || !video.setVideoId;
    removeOne.setAttribute('aria-label', `Remove ${video.title} from ${sourceTitle}`);
    removeOne.onclick = () => remove([video]);
    const moveOne=document.createElement('button');moveOne.textContent='Move…';moveOne.className='row-remove';moveOne.disabled=removeOne.disabled || !video.videoId;moveOne.onclick=()=>openMove([video]);
    rowActions.append(duration, moveOne, removeOne);
    if(video.unavailable&&!video.recovered){
     const attempt=state.recoveryAttempts?.[video.videoId];
     if(attempt){const status=document.createElement('small');status.className='recovery-row-status';status.textContent=attempt.status==='not_found'?'No recoverable details found':`Recovery failed: ${attempt.error}`;status.title=`Last attempted ${new Date(attempt.checkedAt).toLocaleString()}`;description.append(status);}
     const recover=document.createElement('button');recover.type='button';recover.textContent=attempt?'Retry recovery':'Recover details';recover.className='row-remove';recover.disabled=busy||!video.videoId;recover.onclick=()=>recoverMissing([video]);rowActions.append(recover);
    }
    const position=document.createElement('span');position.className='row-number';position.textContent=String(page*PAGE_SIZE+offset+1);
    const selectionCell=document.createElement('div');selectionCell.className='row-selector';selectionCell.append(position,check);
    row.append(selectionCell, details, rowActions); rows.append(row);
  }
}

function recoveryCandidates(all=false){
 return state.videos.filter(v=>v.unavailable&&v.videoId&&!v.recovered&&(all||!selected.size||selected.has(v.key)));
}
async function recoverMissing(items){
 if(busy||!account)return;
 const owner=account;
 // Request optional archive access only on the user's explicit recovery action.
 let allowed;
 try{allowed=await chrome.permissions.request({origins:['https://web.archive.org/*']});}
 catch(error){message(error.message,true);return;}
 if(!allowed)message('Archive access was not granted. Checking YouTube metadata only.');
 if(owner!==account)return;
 await exclusive(async()=>{
  const latest=(await chrome.storage.local.get(storageKey()))[storageKey()];
  if(latest?.updated!==state.updated||latest?.pending)throw new Error('Playlist state changed. Reconnect before recovering details.');
  recoveryController=new AbortController();let found=0,checked=0,unavailable=0,failed=0;
  const unique=[...new Map(items.map(v=>[v.videoId,v])).values()];
  const updateCount=(status='Recovering')=>{
   $('recovery-count').hidden=false;
   $('recovery-count').textContent=`${status}: ${checked}/${unique.length} checked · ${found} recovered · ${unavailable} unavailable${failed?` · ${failed} failed`:''}`;
  };
  updateCount();
  try{
   for(const video of unique){
    if(stopped)break;
    let detail=state.recoveredMetadata?.[video.videoId];
    try{
     detail ||= await recoverDetails(video.videoId,{allowArchive:allowed,signal:recoveryController.signal,onStage:stage=>message(`Recovering details ${checked+1}/${unique.length}: ${stage}… ${found} recovered.`)});
    }catch(error){
     if(stopped)break;
     state.recoveryAttempts||={};state.recoveryAttempts[video.videoId]={status:'error',error:error.message,checkedAt:Date.now()};await save();checked++;failed++;updateCount();render();
     if(/Rate limited/.test(error.message)){updateCount('Paused');message(`Recovery paused by rate limiting. ${found} recovered details saved. Retry later.`,true);return;}
     if(checked<unique.length)await new Promise(resolve=>setTimeout(resolve,1000));
     continue;
    }
    checked++;state.recoveryAttempts||={};
    if(detail){state.recoveredMetadata||={};state.recoveredMetadata[video.videoId]=detail;state.videos=applyRecovered(state.videos,state.recoveredMetadata);delete state.recoveryAttempts[video.videoId];found++;}
    else {unavailable++;state.recoveryAttempts[video.videoId]={status:'not_found',checkedAt:Date.now()};}
    await save();updateCount();render();
    if(checked<unique.length&&!stopped)await new Promise(resolve=>setTimeout(resolve,1000));
   }
   updateCount(stopped?'Stopped':'Finished');
   message(`${stopped?'Stopped':'Recovery finished'}: ${found} recovered, ${checked-found} not recovered (see row status). Videos remain marked unavailable.${allowed?'':' Archive was not checked because permission was not granted.'}`);
  }finally{recoveryController=null;}
 });
}
$('recover-details').onclick=()=>recoverMissing(recoveryCandidates().filter(v=>selected.has(v.key)));
$('recover-all-details').onclick=()=>recoverMissing(recoveryCandidates(true));

function revealFirstChannelResult(){
 window.requestAnimationFrame(()=>{
  const row=$('rows').children[0];
  const header=$('search-workspace');
  if(!row||!row.className.split(' ').includes('video-row')||!row.getBoundingClientRect||!header.getBoundingClientRect)return;
  const top=firstResultScrollTarget({row:row.getBoundingClientRect(),header:header.getBoundingClientRect(),viewportHeight:window.innerHeight,scrollY:window.scrollY});
  if(top!==null)window.scrollTo({top,behavior:'instant'});
 });
}

async function connect() {
  if (busy || connecting) return;
  connecting = true;
  $('connection').textContent = 'Connecting to YouTube…';
  message('Checking your signed-in YouTube tab…');
  render();
  try {
    const tabs = await chrome.tabs.query({url: 'https://www.youtube.com/*'});
    const tab = tabs.find(t=>t.id===preferredTabId) || tabs.find(t => t.active && new URL(t.url).searchParams.get('list') === 'WL') || tabs.find(t => new URL(t.url).searchParams.get('list') === 'WL') || tabs[0];
    if (!tab) throw new Error('Click Open Watch Later, sign in if needed, then return here and connect.');
    tabId = tab.id; account = null; sourceId='WL';sourceTitle='Watch Later';recentRemovalIds=[];
    const identity = await call('identity');
    account = identity.account;
    state = (await chrome.storage.local.get(storageKey()))[storageKey()] || {videos: [], complete: false, updated: null, pending: null};
    const historyData=await chrome.storage.local.get(`history:${account}`);
    state.history=historyData[`history:${account}`]||state.history||[];
    const pageTotal = extractPlaylistTotal({}, identity.pageCountText || '');
    if (!state.youtubeCount && pageTotal !== null) recordTotal(pageTotal, 'YouTube page');
    await refreshTotal();
    if (state.parserVersion !== 2 && state.updated) state.complete = false;
    selected.clear(); selectionAnchor = null; historySelected.clear(); channelFilter = null; page = 0;
    updateSortOptions();
    $('connection').textContent = 'Connected to your YouTube account';
    message(state.pending ? 'Checking an interrupted operation automatically…' : state.updated ? 'Connected. Saved list restored. Click Load / refresh playlist to scan with the updated loader.' : 'Connected. Load your playlist to start searching.', !!state.pending);
  } catch (error) {
    account = null; tabId = null; state = {videos: [], complete: false, updated: null, pending: null}; selected.clear();
    $('connection').textContent = 'YouTube is not connected'; message(error.message, true);
  }
  connecting = false;
  render();
  if(account&&state.pending)await exclusive(async()=>{
   state=(await chrome.storage.local.get(storageKey()))[storageKey()]||state;
   await recoverPending();
  });
}

async function exclusive(task) {
  await navigator.locks.request('watch-later-cleaner-work', {ifAvailable: true}, async lock => {
    if (!lock) { message('Another Cleaner tab is working. Finish or stop it first.', true); return; }
    busy = true; stopped = false; render();
    try { await task(); } catch (error) {
      let recovery='';
      if(state.pending){
       try{await recoverPending();recovery=' Recovery completed; video actions are available again.';}
       catch(recoveryError){recovery=` Automatic recovery could not finish: ${recoveryError.message}`;}
      }
      message(error.message+recovery,true);
    }
    finally { busy = false; render(); }
  });
}

async function recoverPending(){
 if(!state.pending)return;
 if(state.pending.kind==='restore'){
  const pending=state.pending;pending.historyIds||=[];stopped=false;const present=await readDestination(pending.playlistId||sourceId,'reconciling restore');
  for(const h of state.history||[])if(pending.historyIds.includes(h.historyId)&&present.has(h.video.videoId))h.restoredAt=Date.now();
  state.pending=null;await save();await scan();return;
 }
 if(state.pending.kind==='move'&&state.pending.phase==='adding'){
  // This phase is saved before copying; no Watch Later removal has been sent.
  state.pending=null;await save();
  message('Recovered interrupted copy. The source playlist was not changed. Existing destination copies will be checked before another move.');
  return;
 }
 const keep=new Set(selected);
 stopped=false;message('Checking YouTube automatically to recover the interrupted operation…');
 try{await scan();}finally{
  const present=new Set(state.videos.map(v=>v.key));for(const key of keep)if(present.has(key))selected.add(key);
 }
 if(state.pending||!state.complete)throw new Error('The recovery scan did not finish.');
 message('Recovery complete. Your playlist and history are up to date.');
}
async function load() { await exclusive(scan); }
async function scan() {
    const previousPending = state.pending;
    const youtubeCount = state.youtubeCount;
    const history = state.history || [];
    const recoveredMetadata=state.recoveredMetadata||{};
    const recoveryAttempts=state.recoveryAttempts||{};
    state = {videos: [], complete: false, updated: Date.now(), pending: previousPending, parserVersion: 2, channelMetadataVersion: 1, scanDiagnostics: [], youtubeCount, history,recoveredMetadata,recoveryAttempts};
    selected.clear(); selectionAnchor = null; await save();
    let initial = await call('browse', nativeSort || {});
    let options=playlistOptions(initial.data,sourceId);let usedExpandedPage=false;
    {
      try{const pageData=await call('page-data');const pageOptions=playlistOptions(pageData.data,sourceId);state.youtubeTabSort=pageOptions.activeSort;if(pageOptions.alreadyShown && !options.unavailable && !nativeSort){initial=pageData;usedExpandedPage=true;}options={sorts:options.sorts.length?options.sorts:pageOptions.sorts,unavailable:options.unavailable||pageOptions.unavailable,alreadyShown:options.alreadyShown||pageOptions.alreadyShown};}catch{}
    }
    state.listOptions=options;updateSortOptions();
    state.unavailableRequested=usedExpandedPage;
    if(options.unavailable){
      initial=await call('browse',options.unavailable);state.unavailableRequested=true;
      // Recover the chosen native sort from the expanded response, when offered.
      if(nativeSort?.title){
        const expanded=playlistOptions(initial.data,sourceId).sorts.find(s=>s.title===nativeSort.title);
        if(expanded)initial=await call('browse',expanded.command);
        else {nativeSort=null;$('sort').value='original';}
      }
    }
    state.loadedSort=playlistOptions(initial.data,sourceId).activeSort || null;
    updateSortOptions();
    const visited = new Set(); let token = null; let first = true;
    do {
      message(`Loading playlist: ${state.videos.length.toLocaleString()} entries collected… Keep both tabs open.`);
      const result = first ? initial : await call('browse', {token});
      if (first) {
        if (!recordTotal(extractPlaylistTotal(result.data), 'YouTube response') && state.youtubeCount) state.youtubeCount.stale = true;
      }
      const parsed = first&&emptyDestination(result.data)?parsePlaylist({playlistVideoListRenderer:{contents:[]}},true):parsePlaylist(result.data, first);
      state.scanDiagnostics.push(parsed.diagnostic);
      if (parsed.expectedTotal !== null) state.expectedTotal = parsed.expectedTotal;
      const before = state.videos.length;
      state.videos = applyRecovered(mergeEntries(state.videos, parsed.videos),state.recoveredMetadata);
      if (!first && parsed.token && state.videos.length === before) throw new Error('YouTube repeated a page. Scan stopped; refresh to retry.');
      first = false; token = parsed.token;
      if (token && visited.has(token)) throw new Error('Repeated page token. Scan stopped.');
      if (token) visited.add(token);
      state.updated = Date.now(); await save(); render();
      if (parsed.suspiciousEnd) throw new Error('Scan incomplete: YouTube returned a full page or a next-page marker, but no usable continuation was found. Click Export list and send the JSON file so the response structure can be checked. Nothing was removed.');
      if (visited.size > 500) throw new Error('Scan reached its page limit. Partial list saved.');
      // Next page is requested immediately; YouTube controls its response size.
    } while (token && !stopped);
    state.complete = !token;
    if (state.complete) {
      if (previousPending?.kind === 'remove' || (previousPending?.kind === 'move' && previousPending.phase==='removing')) {
        const remaining = new Set(state.videos.map(v=>v.setVideoId));
        rememberRemoved((previousPending.videos || []).filter(v=>!remaining.has(v.setVideoId)), previousPending.started, previousPending.kind==='move'?`Absent after interrupted move to ${previousPending.destination.title}`:'Absent after interrupted removal');
      }
      if (previousPending?.kind === 'restore') {
        const present = new Set(state.videos.map(v=>v.videoId));
        for (const item of state.history || []) if(previousPending.historyIds.includes(item.historyId) && present.has(item.video.videoId)) item.restoredAt = Date.now();
      }
      state.pending = null;
    }
    await save();
    const missing = state.videos.filter(v => !v.setVideoId).length;
    message(`${state.complete ? 'Scan finished' : 'Stopped; partial list saved'}: ${state.videos.length.toLocaleString()} entries. ${missing ? `${missing} entries have no removal ID and cannot be selected. ` : ''}${state.complete ? 'Search and select videos to remove. '+(state.unavailableRequested?'Requested YouTube’s unavailable-video view.':'YouTube did not expose a usable show-unavailable command; hidden entries may still be omitted.') : 'Load / refresh restarts from the beginning.'}`);
}

function updateSortOptions(){
 $('youtube-sort-info').textContent=state.youtubeTabSort?`YouTube tab: ${state.youtubeTabSort} (last checked on load).`:'YouTube tab sort: not reported. Refresh the playlist to check again.';
 const value=$('sort').value || 'original';
 const local=[['original',state.loadedSort?`YouTube order: ${state.loadedSort}`:'YouTube order (sort not reported)'],['reverse','Reverse loaded order'],['title','Title (A–Z)'],['channel','Channel (A–Z)'],['shortest','Duration (shortest)'],['longest','Duration (longest)']];
 const nodes=local.map(([value,title])=>{const option=document.createElement('option');option.value=value;option.textContent=title;return option;});
 for(const [i,sort] of (state.listOptions?.sorts||[]).entries()){
  const option=document.createElement('option');option.value=`native:${i}`;option.textContent=sort.title;nodes.push(option);
 }
 $('sort').replaceChildren(...nodes);$('sort').value=value;
}
$('sort').onchange=async()=>{
 selectionAnchor=null;page=0;
 if($('sort').value.startsWith('native:')){
  const option=state.listOptions?.sorts[Number($('sort').value.split(':')[1])];
  if(!option)return;
  nativeSort={...option.command,title:option.title};
  const preserved=[...selected];await load();
  const present=new Set(state.videos.map(v=>v.key));preserved.filter(k=>present.has(k)).forEach(k=>selected.add(k));
 }
 render();
};
function clearSearch(){
 searchPills=[];searchPaused=false;channelFilter=null;selectionAnchor=null;page=0;
 $('watch-later-cleaner-search').value='';$('unavailable').checked=false;$('watch-filter').value='all';
 $('search-again').hidden=true;render();
 $('watch-later-cleaner-search').focus?.({preventScroll:true});
}
$('clear-search').onclick=clearSearch;$('search-again').onclick=clearSearch;
function review() {
  const items = state.videos.filter(v => selected.has(v.key));
  if (!items.length || busy || !state.complete || state.pending) return;
  $('review').querySelector('h2').textContent=`Remove from ${sourceTitle}?`;
  $('review-count').textContent = `${items.length} videos selected. Up to ${BATCH_SIZE} removals per request.`;
  $('review-list').replaceChildren(...items.map(v => { const li = document.createElement('li'); li.textContent = v.title; return li; }));
  $('review').showModal();
}

async function remove(items = null) {
  let completedCount = 0, completed = false;recentRemovalIds=[];
  $('review').close();
  if (!state.complete || state.pending) return;
  const queue = batches(items || state.videos.filter(v => selected.has(v.key)));
  await exclusive(async () => {
    // Re-read persistent state after acquiring the cross-tab lock.
    const stored = (await chrome.storage.local.get(storageKey()))[storageKey()];
    if (stored?.pending || stored?.updated !== state.updated) throw new Error('The saved list changed. Reconnect and refresh before removing.');
    let count = 0;
    for (const batch of queue) {
      if (stopped) break;
      // Persist BEFORE sending: an interrupted request must be reconciled, not replayed.
      if (state.youtubeCount) state.youtubeCount.stale = true;
      state.pending = {kind: 'remove', ids: batch.map(v => v.setVideoId), videos: batch, started: Date.now()};
      await save();
      message(`Removing batch of ${batch.length}… ${count} removals confirmed so far.`);
      const result = await call('remove', {ids: state.pending.ids});
      confirmRemoval(result.data);
      rememberRemoved(batch, state.pending.started, 'Confirmed removal');
      const keys = new Set(batch.map(v => v.key));
      state.videos = state.videos.filter(v => !keys.has(v.key));
      keys.forEach(key => selected.delete(key));
      state.pending = null; state.updated = Date.now();
      await save(); count += batch.length; render();
      message(`YouTube confirmed ${count} removals. Refreshing the playlist total…`);
      await refreshTotal();
      if (!stopped) await new Promise(r => setTimeout(r, 300));
    }
    message(`${stopped ? 'Stopped.' : 'Done.'} YouTube confirmed ${count} removals. ${selected.size} remain selected. Reload the YouTube page to update its visible rows.`);
    completedCount=count;completed=!stopped;
  });
  if(completed && completedCount>0 && !state.pending){
    $('removal-summary').textContent=`Removed ${completedCount}.`;
    if(matching().length===0){
      clearSearch();$('removal-summary').textContent=`Removed ${completedCount}. Search cleared. Ready for your next search.`;
      $('search-again').hidden=true;
    }else $('search-again').hidden=false;
  }
}


async function fetchEditablePlaylists(){
 // This is YouTube's video-specific Save menu, not a standalone playlist index.
 let videoId=moveItems.find(v=>v.videoId&&!v.unavailable)?.videoId || state.videos.find(v=>v.videoId&&!v.unavailable)?.videoId;
 if(!videoId){
  const first=await call('browse',{playlistId:'WL'});
  videoId=emptyDestination(first.data)?null:parsePlaylist(first.data,true).videos.find(v=>v.videoId&&!v.unavailable)?.videoId;
 }
 if(!videoId)throw new Error('YouTube needs an available video to list editable playlists. Load Watch Later with an available video, then reopen this window. You can still create a playlist.');
 return call('playlists',{videoId});
}
async function openMove(items,manage=false) {
 if(busy || !account || (!manage&&(state.pending || !state.complete)))return;
 managingPlaylists=manage;transferMode='move';
 const countGeneration=++playlistCountGeneration;
 moveItems=manage?[]:items || state.videos.filter(v=>selected.has(v.key));
 if(!manage&&(!moveItems.length || moveItems.some(v=>!v.videoId || !v.setVideoId))){message('Every selected video needs a video ID and removal ID to move.',true);return;}
 $('move-heading').textContent=manage?'Manage playlists':'Move to playlists';
 $('move-cancel').textContent=manage?'Close':'Cancel';
 $('move-status').textContent='Loading your editable playlists…';
 destinations=[];moveDestinationIds.clear();updateDestinationOptions();$('move-target').value='existing';
 $('move-search').value='';updateMoveForm();$('move-playlists').replaceChildren();
 $('move-create-only').disabled=true; $('move-confirm').disabled=true; $('move-search').value=''; $('move-name').value=''; $('move-playlists').replaceChildren(); $('move-new').disabled=true; $('move-existing').disabled=true; $('move-dialog').showModal();
 try {
  const result=await fetchEditablePlaylists();
  destinations=editablePlaylists(result.data).filter(p=>manage||p.id!==sourceId);
  if(!manage&&sourceId!=='WL')destinations.unshift({id:'WL',title:'Watch Later'});
  moveDestinationIds=new Set();
  updateDestinationOptions();
  $('move-target').value=destinations[0]?.id || 'new';updateMoveForm();
  $('move-status').textContent=manage?'Create a playlist or delete one below.':`${moveItems.length} videos. Add to destination, verify they are there, then remove from ${sourceTitle}.`;
  $('move-create-only').disabled=false; $('move-new').disabled=false; $('move-existing').disabled=!destinations.length;
  void loadPlaylistCounts(countGeneration,account);
 } catch(error){
  $('move-status').textContent=error.message;
  $('move-playlists').replaceChildren();
  const note=document.createElement('p');note.textContent='Playlist list could not be loaded. Close and reopen to retry.';$('move-playlists').append(note);
  $('move-new').disabled=false;$('move-create-only').disabled=false;
 }

}
function updateDestinationOptions(){
 const options=destinations.map(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.title;return o;});
 const create=document.createElement('option');create.value='new';create.textContent='Create a new private playlist…';
 $('move-target').replaceChildren(...options,create);
}
function playlistCountText(playlist){
 return Number.isSafeInteger(playlist.videoCount)?`${playlist.videoCount.toLocaleString()} ${playlist.videoCount===1?'video':'videos'}`:playlist.countChecked?'Count unavailable':'Loading count…';
}
async function loadPlaylistCounts(generation,owner){
 for(const playlist of [...destinations]){
  if(generation!==playlistCountGeneration||owner!==account||!$('move-dialog').open)return;
  if(Number.isSafeInteger(playlist.videoCount)||playlist.countChecked)continue;
  // Do not compete with a move/delete. Unknown counts remain explicit.
  if(busy){playlist.countChecked=true;const label=playlistCountLabels.get(playlist.id);if(label)label.textContent=playlistCountText(playlist);continue;}
  let total=null;
  try{
   const response=await call('browse',{playlistId:playlist.id});
   total=extractPlaylistTotal(response.data);
   if(total===null&&emptyDestination(response.data))total=0;
  }catch{}
  if(generation!==playlistCountGeneration||owner!==account||!$('move-dialog').open)return;
  if(!destinations.includes(playlist))continue;
  playlist.videoCount=total;playlist.countChecked=true;
  const label=playlistCountLabels.get(playlist.id);if(label)label.textContent=playlistCountText(playlist);
 }
}
function renderPlaylistPicker(){
 playlistCountLabels.clear();
 const query=$('move-search').value.trim().toLocaleLowerCase();
 const visible=destinations.filter(p=>p.title.toLocaleLowerCase().includes(query));
 const list=$('move-playlists');list.replaceChildren();
 if(!visible.length){const empty=document.createElement('p');empty.textContent='No matching playlists. Create a new one above.';list.append(empty);}
 for(const playlist of visible){
  const row=document.createElement('div');row.className='playlist-row';
  const label=document.createElement('label');label.className='playlist-choice';
  const radio=document.createElement('input');radio.type='checkbox';radio.name='watch-later-move-destination';radio.value=playlist.id;radio.checked=moveDestinationIds.has(playlist.id);radio.hidden=managingPlaylists;radio.disabled=busy;
  radio.onchange=()=>{if(radio.checked)moveDestinationIds.add(playlist.id);else moveDestinationIds.delete(playlist.id);updateMoveForm();};
  const title=document.createElement('span');title.textContent=playlist.title;
  const count=document.createElement('small');count.className='playlist-video-count';count.textContent=playlistCountText(playlist);playlistCountLabels.set(playlist.id,count);
  label.append(radio,title,count);
  const actions=document.createElement('div');actions.className='playlist-row-actions';
  const link=document.createElement('a');link.textContent='Open ↗';link.href=`https://www.youtube.com/playlist?list=${encodeURIComponent(playlist.id)}`;link.target='_blank';link.rel='noopener noreferrer';
  const remove=document.createElement('button');remove.type='button';remove.textContent='Delete';remove.className='danger';remove.disabled=busy||!/^PL[a-zA-Z0-9_-]+$/.test(playlist.id);
  remove.setAttribute('aria-label',`Delete playlist ${playlist.title}`);remove.onclick=()=>askDeletePlaylist(playlist);
  actions.append(link,remove);row.append(label,actions);list.append(row);
 }
}
function updateMoveForm(){
 const create=$('move-target').value==='new';
 $('move-confirm').hidden=managingPlaylists;
 $('move-destination-count').hidden=managingPlaylists;
 $('move-explanation').hidden=managingPlaylists;
 $('move-create-only').hidden=!create;
 $('move-name-wrap').hidden=!create; $('move-existing-wrap').hidden=create;
 $('move-new').setAttribute('aria-pressed',String(create));$('move-existing').setAttribute('aria-pressed',String(!create));
 $('move-confirm').textContent=create?`Create playlist & ${transferMode} videos`:`${transferMode==='copy'?'Copy':'Move'} ${moveItems.length} ${moveItems.length===1?'video':'videos'}`;
 $('transfer-toggle').hidden=managingPlaylists;$('transfer-menu').hidden=true;
 $('transfer-toggle').setAttribute('aria-expanded','false');
 $('move-explanation').textContent=transferMode==='copy'?`Videos stay in ${sourceTitle}. Copies are checked in every destination.`:`Videos are removed from ${sourceTitle} only after every destination is verified. Moves are recorded in history.`;
 $('move-destination-count').textContent=`${moveDestinationIds.size} playlists selected. Videos will be copied to every selected playlist ${transferMode==='copy'?`and kept in ${sourceTitle}`:`before removal from ${sourceTitle}`}.`;
 $('move-confirm').disabled=!create&&!moveDestinationIds.size;
 renderPlaylistPicker();
}
$('move-new').onclick=()=>{ $('move-name').value='';$('move-target').value='new';updateMoveForm();$('move-name').focus?.(); };
$('move-existing').onclick=()=>{if(!destinations.length)return;$('move-target').value=destinations[0].id;updateMoveForm();};
$('move-search').addEventListener('input',renderPlaylistPicker);
async function readDestination(id,stage='reading destination'){
 const items=[];let token=null;let first=true;const visited=new Set();
 do {
  if(stopped)throw new Error('Move stopped before deleting the next source batch.');
  const result=await call('browse',{playlistId:id,token});
  let parsed;
  try{
   parsed=first&&emptyDestination(result.data)?parsePlaylist({playlistVideoListRenderer:{contents:[]}},true):parsePlaylist(result.data,first);
  }catch(error){
   state.lastMoveDiagnostic={stage,page:visited.size+1,structure:playlistStructure(result.data)};await save();
   throw new Error(`Could not read destination while ${stage}: ${error.message} This batch stays in its source playlist. Export list includes a format diagnostic.`);
  }
  if(parsed.suspiciousEnd)throw new Error('Could not fully read destination playlist. Source videos were kept.');
  items.push(...parsed.videos);token=parsed.token;first=false;
  if(token&&visited.has(token))throw new Error('Destination repeated a page token. Source videos were kept.');
  if(token)visited.add(token);
  if(visited.size>500)throw new Error('Destination scan limit reached. Source videos were kept.');
 }while(token);
 return new Set(items.map(v=>v.videoId));
}
async function createPlaylistOnly(){
 if(busy)return;
 const title=$('move-name').value.trim();
 if(!title){$('move-status').textContent='Enter a name for the new private playlist.';return;}
 const controls=['move-create-only','move-confirm','move-cancel','move-new','move-existing','move-name'];
 controls.forEach(id=>$(id).disabled=true);
 try{
  await exclusive(async()=>{
   $('move-status').textContent='Creating your private playlist…';
   try{
    const created=await call('create-playlist',{title});
    const id=created.data?.playlistId;
    if(typeof id!=='string'||!id||id==='WL')throw new Error('YouTube did not confirm the new playlist.');
    destinations=[{id,title,videoCount:0},...destinations.filter(p=>p.id!==id)];
    document.dispatchEvent(new CustomEvent('playlist-created',{detail:{id,title,videoCount:0}}));
    moveDestinationIds.add(id);
    updateDestinationOptions();$('move-target').value=id;$('move-search').value='';
    updateMoveForm();
    $('move-status').textContent=managingPlaylists?`Created “${title}”.`:`Created “${title}” and selected it below. No videos moved. Click Move videos when ready.`;
   }catch(error){$('move-status').textContent=error.message+' No videos moved. Check YouTube before retrying creation.';}
  });
 }finally{
  controls.forEach(id=>$(id).disabled=false);
  // exclusive() has cleared busy; rebuild rows with enabled checkboxes and Delete.
  updateMoveForm();
  $('move-existing').disabled=!destinations.length;
 }
}
$('move-create-only').onclick=createPlaylistOnly;
$('move-name').addEventListener('keydown',event=>{
 if(event.key!=='Enter'||event.isComposing)return;
 event.preventDefault();
 if(event.repeat||busy||$('move-create-only').disabled||$('move-target').value!=='new')return;
 return createPlaylistOnly();
});
$('move-dialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
async function performMove(){
 if(busy)return;
 const chosen=$('move-target').value;
 const title=$('move-name').value.trim();
 if(chosen==='new'&&!title){$('move-status').textContent='Enter a name for the new private playlist.';return;}
 const items=[...moveItems];recentRemovalIds=[];$('move-dialog').close();
 await exclusive(async()=>{
  const stored=(await chrome.storage.local.get(storageKey()))[storageKey()];
  if(stored?.pending || stored?.updated!==state.updated)throw new Error('Playlist state changed. Reconnect before moving.');
  let targets=destinations.filter(p=>moveDestinationIds.has(p.id)&&p.id!==sourceId);
  if(chosen==='new'){
   const created=await call('create-playlist',{title});
   const id=created.data?.playlistId;
   if(typeof id!=='string' || !id || id==='WL')throw new Error('New playlist creation was not confirmed. Nothing removed; check YouTube before retrying.');
   targets=[...targets.filter(p=>p.id!==id),{id,title}];
   destinations=[{id,title},...destinations.filter(p=>p.id!==id)];
   document.dispatchEvent(new CustomEvent('playlist-created',{detail:{id,title,videoCount:0}}));
  }
  if(!targets.length)throw new Error('Select at least one destination playlist.');
  const destination={title:targets.map(p=>p.title).join(', ')};
  const presentById=new Map();
  for(const target of targets)presentById.set(target.id,await readDestination(target.id,'checking destination before copying'));
  let moved=0;
  for(const batch of batches(items)){
   if(stopped)break;
   const allIds=[...new Set(batch.map(v=>v.videoId))];
   state.pending={kind:'move',phase:'adding',destination,destinations:targets,videos:batch,started:Date.now()};await save();
   message(`${transferMode==='copy'?'Copying':'Moving'} to ${targets.length} playlists: ${moved} done. Copying and verifying every destination…`);
   for(const target of targets){
    if(stopped)throw new Error('Move stopped. Source videos were kept.');
    const ids=allIds.filter(id=>!presentById.get(target.id).has(id));
    if(ids.length){
     const response=await call('add-to-playlist',{playlistId:target.id,ids});confirmRemoval(response.data);
    }
    const verified=await verifyDestinationVideos({ids:allIds,
     read:()=>readDestination(target.id,'verifying copied videos'),stopped:()=>stopped,
     onRetry:attempt=>message(`Waiting for ${target.title} to show the copied videos. Checking again (${attempt}/3)…`)});
    presentById.set(target.id,verified.present);
    if(verified.missing.length){
     state.lastMoveDiagnostic={stage:'verification',expected:allIds.length,found:allIds.length-verified.missing.length,missing:verified.missing.length};await save();
     throw new Error(`YouTube has not shown ${verified.missing.length} of ${allIds.length} videos in ${target.title} after repeated checks. This batch remains in its source playlist. Copies already present will be skipped on your next move.`);
    }
   }
   if(stopped)throw new Error('Stopped after copying. Source videos were kept.');
   if(transferMode==='copy'){state.pending=null;state.updated=Date.now();await save();moved+=batch.length;continue;}
   state.pending.phase='removing';await save();
   const response=await call('remove',{ids:batch.map(v=>v.setVideoId)});confirmRemoval(response.data);
   rememberRemoved(batch,state.pending.started,`Moved to ${destination.title}`);
   const keys=new Set(batch.map(v=>v.key));state.videos=state.videos.filter(v=>!keys.has(v.key));keys.forEach(k=>selected.delete(k));
   state.pending=null;state.updated=Date.now();await save();moved+=batch.length;await refreshTotal();
  }
  message(`${transferMode==='copy'?'Copied':'Moved'} ${moved} videos to ${destination.title}.${transferMode==='copy'?` Originals remain in ${sourceTitle}.`:' Recorded in removal history.'}`);
  if(transferMode==='move'&&moved&&!stopped){$('removal-summary').textContent=`Moved ${moved}.`;$('search-again').hidden=false;if(!matching().length)clearSearch();}
 });
}
$('manage-playlists').onclick=()=>openMove([],true);
function askDeletePlaylist(playlist){
 if(busy||!destinations.some(p=>p.id===playlist.id))return;
 deleteTarget={...playlist};
 $('delete-playlist-name').textContent=playlist.title;
 $('delete-playlist-link').href=`https://www.youtube.com/playlist?list=${encodeURIComponent(playlist.id)}`;
 $('delete-playlist-id').textContent=`Playlist ID: ${playlist.id}`;
 $('delete-playlist-status').textContent='This deletes the whole playlist. The videos themselves and other playlists remain. Deleted playlists cannot be restored from removal history.';
 $('delete-playlist-confirm').disabled=false;
 $('delete-playlist-dialog').showModal();
}
$('delete-playlist-cancel').onclick=()=>{if(!busy){deleteTarget=null;$('delete-playlist-dialog').close();}};
$('delete-playlist-dialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();else deleteTarget=null;});
$('delete-playlist-confirm').onclick=async()=>{
 if(busy||!deleteTarget)return;
 const target={...deleteTarget};
 await exclusive(async()=>{
  $('delete-playlist-confirm').disabled=true;$('delete-playlist-cancel').disabled=true;
  $('delete-playlist-status').textContent='Deleting playlist and refreshing the list…';
  try{
   const response=await call('delete-playlist',{playlistId:target.id});
   if(response.data?.status && response.data.status!=='STATUS_SUCCEEDED')throw new Error('YouTube did not confirm deletion.');
   if((response.data?.alerts||[]).some(a=>a.alertRenderer?.type==='ERROR'||a.alertWithButtonRenderer?.type==='ERROR'))throw new Error('YouTube rejected deletion.');
   const refreshed=await fetchEditablePlaylists();
   const listShape=JSON.stringify(refreshed.data||{});
   if(!/"(?:addToPlaylistRenderer|playlistAddToOptionRenderer)"/.test(listShape))throw new Error('Could not read the refreshed playlist list.');
   const remaining=editablePlaylists(refreshed.data);
   if(remaining.some(p=>p.id===target.id))throw new Error('The playlist still appears in YouTube’s list.');
   destinations=destinations.filter(p=>p.id!==target.id);moveDestinationIds.delete(target.id);
   const chosen=$('move-target').value;
   updateDestinationOptions();$('move-target').value=destinations.some(p=>p.id===chosen)?chosen:destinations[0]?.id||'new';
   updateMoveForm();$('move-existing').disabled=!destinations.length;
   $('move-status').textContent=`Deleted “${target.title}”.`;
   deleteTarget=null;$('delete-playlist-dialog').close();
  }catch(error){$('delete-playlist-status').textContent=error.message+' Deletion could not be verified. Close this message and reopen Manage playlists to refresh before trying again.';}
  finally{$('delete-playlist-cancel').disabled=false;}
 });
 if(!deleteTarget)document.dispatchEvent(new CustomEvent('playlist-deleted',{detail:{id:target.id}}));
 renderPlaylistPicker();
};
$('move').onclick=()=>openMove();$('move-cancel').onclick=()=>$('move-dialog').close();$('move-target').onchange=updateMoveForm;$('move-confirm').onclick=performMove;

function renderSelected() {
 const videos=state.videos.filter(v=>selected.has(v.key));
 selectedPage=Math.min(selectedPage,Math.max(0,Math.ceil(videos.length/100)-1));
 $('selected-heading').textContent=`Selected videos (${videos.length.toLocaleString()})`;
 $('selected-prev').disabled=selectedPage===0;
 $('selected-next').disabled=(selectedPage+1)*100>=videos.length;
 $('selected-pageinfo').textContent=videos.length?`${selectedPage*100+1}–${Math.min(videos.length,(selectedPage+1)*100)} of ${videos.length}`:'No videos selected';
 const list=$('selected-rows');list.replaceChildren();
 for(const video of videos.slice(selectedPage*100,(selectedPage+1)*100)){
  const label=document.createElement('label');label.className='selected-entry';
  const check=document.createElement('input');check.type='checkbox';check.checked=true;check.disabled=busy;
  check.setAttribute('aria-label',`Deselect ${video.title}`);
  check.onchange=()=>{selected.delete(video.key);selectionAnchor=null;render();};
  const details=document.createElement('span');const title=document.createElement('strong');title.textContent=video.title;
  const channel=document.createElement('small');channel.textContent=video.channel;details.append(title,channel);
  label.append(check,details);list.append(label);
 }
}
$('selected-view').onclick=()=>{selectedPage=0;renderSelected();$('selected-dialog').showModal();};
$('selected-close').onclick=()=>$('selected-dialog').close();
$('selected-prev').onclick=()=>{selectedPage--;renderSelected();};
$('selected-next').onclick=()=>{selectedPage++;renderSelected();};
$('select-all-checkbox').onchange=()=>{
 const check=$('select-all-checkbox').checked;
 for(const video of matching())if(video.setVideoId){if(check)selected.add(video.key);else selected.delete(video.key);}
 selectionAnchor=null;render();
};
function rememberRemoved(videos, time, outcome) {
  state.history ||= [];
  for (const video of videos) {
    if (state.history.some(h=>h.video.setVideoId===video.setVideoId && h.removedAt===time)) continue;
    const historyId=crypto.randomUUID();recentRemovalIds.push(historyId);
    state.history.unshift({historyId,sourceId,sourceTitle,video:structuredClone(applyRecovered([video],state.recoveredMetadata)[0]), removedAt: time, outcome, restoredAt: null});
  }
}
function restorable() { return (state.history || []).filter(h=>!h.restoredAt && h.video.videoId); }
function renderHistory() {
  state.history=recoverHistoryDetails(state.history,state.recoveredMetadata);
  const history = (state.history || []).filter(h=>((h.video.title||'')+' '+(h.video.channel||'')+' '+(h.sourceTitle||'Watch Later')).toLowerCase().includes(($('history-search')?.value||'').toLowerCase()));
  const size = new TextEncoder().encode(JSON.stringify(history)).length;
  $('history-count').textContent = `${history.length} entries · ${(size/1024).toFixed(0)} KB stored locally`;
  $('history-restore-selected').disabled = busy || !!state.pending || !historySelected.size;
  $('history-restore-all').disabled = busy || !!state.pending || !restorable().length;
  $('history-select').disabled = busy || !restorable().length;
  $('history-clear').disabled = busy || !historySelected.size;
  $('history-export').disabled = !history.length;
  $('history-selection').textContent = `${historySelected.size} selected`;
  historyPage = Math.min(historyPage, Math.max(0,Math.ceil(history.length/100)-1));
  $('history-prev').disabled = historyPage===0;
  $('history-next').disabled = (historyPage+1)*100>=history.length;
  $('history-page').textContent = history.length ? `${historyPage*100+1}–${Math.min(history.length,(historyPage+1)*100)} of ${history.length}` : 'History starts with removals made in this version.';
  const list = $('history-rows'); list.replaceChildren();
  for (const item of history.slice(historyPage*100,(historyPage+1)*100)) {
    const row=document.createElement('div');row.className='history-row';
    const check=document.createElement('input');check.type='checkbox';check.checked=historySelected.has(item.historyId);check.disabled=busy || !!item.restoredAt || !item.video.videoId;
    check.setAttribute('aria-label',`Select removal: ${item.video.title}`);
    check.onchange=()=>{if(check.checked)historySelected.add(item.historyId);else historySelected.delete(item.historyId);renderHistory();};
    const detail=document.createElement('div');const title=document.createElement('strong');title.textContent=item.video.title;
    const meta=document.createElement('small');meta.textContent=`${item.sourceTitle||'Watch Later'} · ${item.video.channel || ''} · ${new Date(item.removedAt).toLocaleString()} · ${item.restoredAt ? 'Restored / already present' : item.outcome}`;
    detail.append(title,meta);
    if(item.video.recovered?.sourceUrl){
     const source=document.createElement('a');source.textContent=item.video.recovered.source==='archive'?'Archived details ↗':'Recovered details ↗';source.href=item.video.recovered.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';detail.append(source);
    }
    const button=document.createElement('button');button.textContent=item.restoredAt?'Restored':'Restore';button.disabled=busy || !!state.pending || !!item.restoredAt || !item.video.videoId;
    button.onclick=()=>restore([item.historyId]);row.append(check,detail,button);list.append(row);
  }
}
async function restore(historyIds) {
 if(busy||state.pending||!historyIds.length)return;
 await exclusive(async()=>{
  const wanted=new Set(historyIds),candidates=(state.history||[]).filter(h=>wanted.has(h.historyId)&&!h.restoredAt&&h.video.videoId);
  const groups=new Map();for(const h of candidates){const id=h.sourceId||'WL';if(!groups.has(id))groups.set(id,[]);groups.get(id).push(h);}
  let restored=0;
  for(const [id,entries] of groups){
   if(stopped)break;
   message(`Checking ${entries[0].sourceTitle||'Watch Later'} before restoring…`);
   const present=await readDestination(id,'checking restore destination');
   for(const h of entries)if(present.has(h.video.videoId)){h.restoredAt=Date.now();const current=state.history.find(item=>item.historyId===h.historyId);if(current)current.restoredAt=h.restoredAt;historySelected.delete(h.historyId);}
   const missing=[...new Set(entries.filter(h=>!h.restoredAt).map(h=>h.video.videoId))];
   if(present.size+missing.length>5000)throw new Error('Not enough playlist space. Select fewer entries to restore.');
   await save();
   for(let i=0;i<missing.length;i+=BATCH_SIZE){
    if(stopped)break;
    const ids=missing.slice(i,i+BATCH_SIZE),batch=entries.filter(h=>ids.includes(h.video.videoId));
    state.pending={kind:'restore',playlistId:id,ids,historyIds:batch.map(h=>h.historyId),started:Date.now()};await save();
    const result=await call('restore',{playlistId:id,ids});confirmRemoval(result.data);
    const check=await verifyDestinationVideos({ids,read:()=>readDestination(id,'verifying restored videos'),stopped:()=>stopped});
    if(check.missing.length)throw new Error('Some restored videos are not visible yet. Checking automatically before another restore.');
    const restoredIds=new Set(batch.map(h=>h.historyId));
    for(const h of state.history)if(restoredIds.has(h.historyId)){h.restoredAt=Date.now();historySelected.delete(h.historyId);}
    state.pending=null;if(id===sourceId)state.complete=false;await save();restored+=ids.length;
   }
  }
  if(!stopped)await scan();
  message(`${restored} videos restored to their original playlists. Videos already present were skipped.${stopped?' Stopped.':''}`);
 });
}
function exportHistory() {
  const url=URL.createObjectURL(new Blob([JSON.stringify({exported:new Date().toISOString(),history:state.history || []},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='watch-later-removal-history.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('history-select').onclick=()=>{restorable().forEach(h=>historySelected.add(h.historyId));renderHistory();};
$('history-clear').onclick=()=>{historySelected.clear();renderHistory();};
$('history-restore-selected').onclick=()=>restore([...historySelected]);
$('history-restore-all').onclick=()=>restore(restorable().map(h=>h.historyId));
$('history-export').onclick=exportHistory;
$('history-prev').onclick=()=>{historyPage--;renderHistory();};
$('history-next').onclick=()=>{historyPage++;renderHistory();};

$('open').onclick = () => chrome.tabs.create({url: 'https://www.youtube.com/playlist?list=WL'});
$('refresh-count').onclick = () => exclusive(refreshTotal);
$('connect').onclick = connect; $('load').onclick = load;
$('stop').onclick = () => { stopped = true; recoveryController?.abort(); message('Stopping after the current request finishes…'); };
for (const id of ['field', 'watch-filter']) $(id).addEventListener('input', () => { selectionAnchor = null; page = 0; render(); });
$('watch-later-cleaner-search').addEventListener('input',()=>{
 const parsed=splitPills($('watch-later-cleaner-search').value);
 searchPills=[...new Set([...searchPills,...parsed.complete])];
 $('watch-later-cleaner-search').value=parsed.tail;
 searchPaused=parsed.complete.length>0&&!parsed.tail.trim();
 selectionAnchor=null;page=0;render();
});
$('watch-later-cleaner-search').addEventListener('keydown',event=>{
 if(event.key==='Enter'&&!$('watch-later-cleaner-search').value.trim()){event.preventDefault();searchPaused=false;page=0;render();}
 if(event.key==='Enter'&&$('watch-later-cleaner-search').value.trim()){
  event.preventDefault();const term=$('watch-later-cleaner-search').value.trim();
  if(!parseSearch(term).error){searchPaused=false;if(!searchPills.includes(term))searchPills.push(term);$('watch-later-cleaner-search').value='';selectionAnchor=null;page=0;render();}
 }
});
$('unavailable').addEventListener('input',async()=>{
 selectionAnchor=null;page=0;
 if($('unavailable').checked && !state.unavailableRequested){
  const preserved=[...selected];await load();const present=new Set(state.videos.map(v=>v.key));preserved.filter(k=>present.has(k)).forEach(k=>selected.add(k));
 }
 render();
 if($('unavailable').checked && !state.videos.some(v=>v.unavailable))message(state.unavailableRequested?'YouTube returned no identifiable unavailable entries, even after requesting the expanded view.':'No unavailable entries returned. YouTube did not expose a usable show-unavailable command. Export the list so its menu diagnostics can be checked.',true);
});
$('clear-channel').onclick = () => { selectionAnchor = null; channelFilter = null; page = 0; render(); };
$('select').onclick = () => { matching().filter(v => v.setVideoId).forEach(v => selected.add(v.key)); render(); };
$('clear').onclick = () => { selectionAnchor = null; selected.clear(); render(); };
$('prev-top').onclick = () => { page--; render(); }; $('next-top').onclick = () => { page++; render(); };
$('prev').onclick = () => { page--; render(); }; $('next').onclick = () => { page++; render(); };
$('remove').onclick = review; $('cancel').onclick = () => $('review').close(); $('confirm').onclick = () => remove();
$('export').onclick = () => {
  const data = {lastMoveDiagnostic:state.lastMoveDiagnostic || null,exported: new Date().toISOString(), scanComplete: state.complete, scanDiagnostics: state.scanDiagnostics || [], expectedTotal: state.expectedTotal ?? null, listOptions: {sorts:(state.listOptions?.sorts||[]).map(s=>s.title),hasUnavailableCommand:!!state.listOptions?.unavailable,unavailableRequested:!!state.unavailableRequested}, youtubeCount: state.youtubeCount || null, videos: state.videos.map(v => ({...v, url: v.videoId ? `https://www.youtube.com/watch?v=${v.videoId}` : null}))};
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'watch-later-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('forget').onclick = async () => {
  if (!confirm('Clear this account’s saved playlist cache? Removal history will be kept. This does not remove any videos from YouTube.')) return;
  state = {videos: [], complete: false, updated: null, pending: state.pending, history: state.history || [],recoveredMetadata:state.recoveredMetadata||{},recoveryAttempts:state.recoveryAttempts||{}}; await save(); selected.clear(); render(); message('Playlist cache cleared. Removal history is kept.');
};
window.addEventListener('beforeunload', event => { if (busy) { event.preventDefault(); event.returnValue = ''; } });
initWorkspace({
 get:()=>({account,tabId,state,busy,connecting,sourceId,sourceTitle,selected}),
 call,exclusive,save,render,message,scan,refreshTotal,fetchEditablePlaylists,isStopped:()=>stopped,
 openMove,askDeletePlaylist,readDestination,confirmRemoval,
 connect:async(id)=>{preferredTabId=id||null;await connect();},
 disconnect:()=>{if(busy)return;account=null;tabId=null;state={videos:[],complete:false};selected.clear();$('connection').textContent='Disconnected';render();},
 switchPlaylist:async(id,title)=>{if(busy||!account)return false;await save();sourceId=id;sourceTitle=title;const saved=await chrome.storage.local.get([storageKey(),`history:${account}`]);state=saved[storageKey()]||{videos:[],complete:false,updated:null,pending:null};state.history=saved[`history:${account}`]||[];selected.clear();nativeSort=null;clearSearch();updateSortOptions();if(state.pending)await exclusive(recoverPending);render();return true;},
 listDestinations:()=>destinations,setDestinations:list=>{destinations=list;}
});
$('undo-last').onclick=()=>restore([...recentRemovalIds]);
$('history-search').oninput=()=>{historyPage=0;renderHistory();};
for(const id of ['played-min','played-max'])$(id).oninput=()=>{page=0;render();};
$('transfer-toggle').onclick=()=>{$('transfer-menu').hidden=!$('transfer-menu').hidden;$('transfer-toggle').setAttribute('aria-expanded',String(!$('transfer-menu').hidden));};
for(const b of document.querySelectorAll('[data-transfer]'))b.onclick=()=>{transferMode=b.dataset.transfer;updateMoveForm();};
render();connect();
