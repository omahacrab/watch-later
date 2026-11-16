import {parsePlaylist,mergeEntries,filterEntries,parseSearch} from './core.js';
import {editablePlaylists,emptyDestination,verifyDestinationVideos} from './playlists.js';
import {extractPlaylistTotal} from './counts.js';
import {applyRecovered} from './recovery.js';
import {playlistOptions} from './list-options.js';
import {parseChannelSearch,channelVideosCommand,parseUploads,discoverChannels,mergeChannelLibrary,categoryVideos,removeCategory,channelIdValid,validLibrary} from './feeds-core.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const unique=a=>[...new Set(a)];
const $=id=>document.getElementById(id);
const key=(account,id)=>id==='WL'?`playlist:${account}`:`playlist:${account}:${id}`;
const shortCount=p=>Number.isSafeInteger(p.videoCount)?`${p.videoCount.toLocaleString()} videos`:'Count unavailable';
const link=id=>`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
const thumb=id=>`https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`;
const btn=(action,text,extra='')=>`<button type="button" data-ui="${action}" ${extra}>${text}</button>`;
export function initWorkspace(api){
 let owner=null,hydrating=false,view='watch',section='feed',channelMode='library',channelQuery='',searchQuery='',channelResults=[],channelToken=null,channelSort='name',channelCategory='all';
 let library={categories:[],channels:[],feeds:[]},playlistList=[],sourceCache=new Map(),uploadCache=new Map(),channelSelected=new Set();
 let cats=[],all=true,feedId=null,feedSource='uploads',feedPlaylists=['WL'],feedQuery='',feedSort='newest',feedPage=0,sourceChoices=['WL'];
 let feedNotice='',dialogChannel=null,dialogSaved=false;
 const root=$('feeds-view'),dialog=$('workspace-dialog');
 const ready=()=>{const s=api.get();return !!s.account&&!s.busy&&!s.connecting;};
 const allSaved=()=>[...new Map([...sourceCache.values()].flatMap(s=>s.videos||[]).map(v=>[v.videoId||v.key,v])).values()];
 const getChannel=id=>library.channels.find(c=>c.id===id)||channelResults.find(c=>c.id===id);
 const saveLibrary=async()=>{if(owner&&owner===api.get().account)await chrome.storage.local.set({[`feeds:${owner}`]:library});};
 const savePlaylists=async()=>{if(owner)await chrome.storage.local.set({[`destinations:${owner}`]:playlistList});};
 function discover(){library= {...library,channels:mergeChannelLibrary(library.channels,discoverChannels(allSaved()))};}
 function sync(){
  const s=api.get();if(s.account!==owner){void hydrate();return;}
  if(owner)sourceCache.set(s.sourceId,s.state);
  $('back-playlists').hidden=s.sourceId==='WL';
  for(const id of ['playlists-refresh','playlist-create'])$(id).disabled=!ready();
  $('playlist-cards').querySelectorAll('[data-requires-account]').forEach(b=>b.disabled=!ready()||b.hasAttribute('data-blocked'));
  root.querySelectorAll('[data-requires-account]').forEach(b=>b.disabled=!ready()||b.hasAttribute('data-blocked'));
  dialog.querySelectorAll('[data-requires-account]').forEach(b=>b.disabled=!ready()||b.hasAttribute('data-blocked'));
 }
 async function hydrate(){
  if(hydrating)return;hydrating=true;
  try{
   owner=api.get().account;const expected=owner;
   library={categories:[],channels:[],feeds:[]};playlistList=[];sourceCache=new Map();uploadCache=new Map();channelSelected.clear();channelResults=[];channelToken=null;cats=[];all=true;feedId=null;feedNotice='';feedPage=0;feedPlaylists=['WL'];sourceChoices=['WL'];
   if(owner){const data=await chrome.storage.local.get(null);if(api.get().account!==expected)return;
    library=data[`feeds:${owner}`]||library;playlistList=data[`destinations:${owner}`]||[];
    for(const [k,v] of Object.entries(data)){if(k===key(owner,'WL'))sourceCache.set('WL',v);else if(k.startsWith(`playlist:${owner}:`))sourceCache.set(k.slice(`playlist:${owner}:`.length),v);}
    sourceCache.set(api.get().sourceId,api.get().state);discover();await saveLibrary();
   }
   renderPlaylists();renderFeeds();sync();
  }finally{hydrating=false;if(api.get().account!==owner)void hydrate();}
 }
 function setView(next){view=next;for(const name of ['watch','playlists','history','feeds'])$(`${name}-view`).hidden=name!==next;
  document.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===next)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(next==='feeds'){discover();renderFeeds();}if(next==='playlists')renderPlaylists();
 }
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=async()=>{if(api.get().busy)return;if(b.dataset.view==='watch'&&api.get().sourceId!=='WL')await api.switchPlaylist('WL','Watch Later');setView(b.dataset.view);if(b.dataset.view==='playlists'&&ready()&&!playlistList.length)await refreshPlaylists();});
 $('back-playlists').onclick=()=>setView('playlists');
 // Progress and Stop stay available in every workspace view.
 const connection=document.querySelector('.connection');connection.querySelector('.actions')?.append($('stop'));$('watch-view').before($('status'));
 document.addEventListener('workspace-state',sync);
 function modal(title,body,footer=''){
  dialog.innerHTML=`<div class="dialog-heading"><h2>${esc(title)}</h2>${btn('close-dialog','×','aria-label="Close dialog"')}</div><div class="dialog-body">${body}</div>${footer?`<div class="dialog-footer">${footer}</div>`:''}`;
  if(!dialog.open)dialog.showModal();sync();
 }
 dialog.addEventListener('cancel',e=>{if(api.get().busy)e.preventDefault();});
 function options(){return [{id:'WL',title:'Watch Later',videoCount:sourceCache.get('WL')?.youtubeCount?.value},...playlistList];}
 function sourcePicker(chosen,kind){return `<div class="source-picker">${options().map(p=>`<label><input type="checkbox" data-source="${kind}" value="${esc(p.id)}" ${chosen.includes(p.id)?'checked':''}>${esc(p.title)}</label>`).join('')}</div>`;}
 function renderPlaylists(){
  const query=$('playlist-search').value.trim().toLowerCase();const entries=playlistList.filter(p=>p.title.toLowerCase().includes(query));
  $('playlist-cards').innerHTML=entries.map(p=>`<article class="playlist-card"><div class="card-meta"><span class="playlist-mark" aria-hidden="true">☷</span><span class="privacy">${esc(p.privacy||'YOUR PLAYLIST')}</span></div><h2>${esc(p.title)}</h2><span class="muted">${shortCount(p)}</span><div class="actions">${btn('open-playlist','View playlist',`data-id="${esc(p.id)}" data-requires-account`)}${btn('delete-playlist','Delete',`data-id="${esc(p.id)}" class="danger-link" data-requires-account`)}</div></article>`).join('')||`<div class="empty">${owner?'No playlists shown. Refresh your playlists or create one.':'Connect to YouTube to load your playlists.'}</div>`;sync();
 }
 async function refreshPlaylists(){if(!ready())return;await api.exclusive(async()=>{
  $('playlist-status').textContent='Reading your editable playlists…';const response=await api.fetchEditablePlaylists();
  if(!JSON.stringify(response.data).match(/addToPlaylistRenderer|playlistAddToOptionRenderer/))throw new Error('YouTube returned an unfamiliar playlist list. Your saved list has been kept.');
  playlistList=editablePlaylists(response.data);await savePlaylists();renderPlaylists();
  for(let i=0;i<playlistList.length;i++){
   if(api.isStopped())break;const p=playlistList[i];if(Number.isSafeInteger(p.videoCount))continue;
   $('playlist-status').textContent=`Reading playlist counts: ${i+1}/${playlistList.length}`;
   try{const result=await api.call('browse',{playlistId:p.id});p.videoCount=extractPlaylistTotal(result.data);if(p.videoCount===null&&emptyDestination(result.data))p.videoCount=0;}catch(error){if(/429/.test(error.message))break;}
   renderPlaylists();
  }await savePlaylists();$('playlist-status').textContent=`${playlistList.length} playlists. Counts reflect the latest response from YouTube.`;api.message('Playlist list updated.');renderPlaylists();
 });}
 $('playlists-refresh').onclick=refreshPlaylists;$('playlist-search').oninput=renderPlaylists;
 $('playlist-create').onclick=async()=>{if(!ready())return;await api.openMove([],true);$('move-new').click();};
 async function openPlaylist(id){if(!ready())return;const p=options().find(p=>p.id===id);if(!p)return;if(!await api.switchPlaylist(id,p.title))return;setView('watch');if(!api.get().state.complete)await api.exclusive(api.scan);sourceCache.set(id,api.get().state);discover();await saveLibrary();}

 $('move-dialog').addEventListener('close',()=>{void (async()=>{
  // The move picker excludes the source, so retain it when syncing the index.
  const incoming=api.listDestinations().filter(p=>p.id!=='WL');if(incoming.length){const source=playlistList.find(p=>p.id===api.get().sourceId);playlistList=[...new Map([...(source?[source]:[]),...incoming].map(p=>[p.id,p])).values()];await savePlaylists();renderPlaylists();}
 })();});
 document.addEventListener('playlist-deleted',event=>{void(async()=>{
  const id=event.detail.id;playlistList=playlistList.filter(p=>p.id!==id);sourceCache.delete(id);feedPlaylists=feedPlaylists.filter(p=>p!==id);sourceChoices=sourceChoices.filter(p=>p!==id);
  await chrome.storage.local.remove(key(owner,id));await savePlaylists();if(api.get().sourceId===id){await api.switchPlaylist('WL','Watch Later');setView('playlists');}renderPlaylists();renderFeeds();
 })().catch(e=>api.message(e.message,true));});
 document.addEventListener('playlist-created',event=>{const p=event.detail;playlistList=[p,...playlistList.filter(x=>x.id!==p.id)];void savePlaylists();renderPlaylists();});
 document.addEventListener('playlist-mutated',event=>{
  const id=event.detail.id,playlist=playlistList.find(p=>p.id===id),cached=sourceCache.get(id);if(playlist)playlist.videoCount=null;if(cached&&id!==api.get().sourceId){cached.complete=false;if(cached.youtubeCount)cached.youtubeCount.stale=true;}
  renderPlaylists();
 });
 async function readPlaylist(id){
  if(id===api.get().sourceId){await api.scan();const result=api.get().state;if(!result.complete)throw new Error('Playlist loading was stopped. Partial data is saved.');sourceCache.set(id,result);return result;}
  const stored=(await chrome.storage.local.get(key(owner,id)))[key(owner,id)]||{};
  let result=await api.call('browse',{playlistId:id});const expanded=playlistOptions(result.data,id).unavailable;if(expanded)result=await api.call('browse',{playlistId:id,...expanded});
  const count=extractPlaylistTotal(result.data);let videos=[],first=true,token=null;const visited=new Set();
  do{
   if(api.isStopped())throw new Error('Playlist scan stopped. Previously loaded data is kept.');
   if(!first)result=await api.call('browse',{playlistId:id,token});
   const parsed=first&&emptyDestination(result.data)?{videos:[],token:null}:parsePlaylist(result.data,first);
   videos=mergeEntries(videos,parsed.videos);if(parsed.suspiciousEnd)throw new Error('YouTube did not return a usable next page. Previously loaded data is kept.');
   token=parsed.token;first=false;if(token&&visited.has(token))throw new Error('YouTube repeated a playlist page.');if(token)visited.add(token);if(visited.size>500)throw new Error('Playlist scan limit reached.');
   api.message(`Loading ${options().find(p=>p.id===id)?.title||'playlist'}: ${videos.length} videos…`);
  }while(token);
  const latest=(await chrome.storage.local.get(key(owner,id)))[key(owner,id)]||stored;
  const next={...latest,videos:applyRecovered(videos,latest.recoveredMetadata),complete:true,updated:Date.now(),parserVersion:2,youtubeCount:count===null?latest.youtubeCount:{value:count,source:'YouTube response',checkedAt:Date.now(),stale:false}};
  sourceCache.set(id,next);await chrome.storage.local.set({[key(owner,id)]:next});return next;
 }
 const chosenChannels=()=>library.channels.filter(c=>c.added&&(all||c.cats.some(id=>cats.includes(id))));
 function detach(){feedId=null;feedPage=0;}
 function renderFeeds(){
  const saved=library.feeds.find(f=>f.id===feedId);const title=saved?.name||(all?'All channels':cats.map(id=>library.categories.find(c=>c.id===id)?.name).filter(Boolean).join(' + ')||'Choose a category');
  root.innerHTML=`<div class="page-heading"><div><h1>My feeds</h1><p>Channels you choose. Categories you can combine.</p></div><div class="actions">${btn('manage-categories','Manage categories')}${btn('add-channels','+ Add channels')}</div></div><div class="feed-tabs">${btn('feed-tab','Feeds',`class="${section==='feed'?'active':''}"`)}${btn('channels-tab',`Channels (${library.channels.filter(c=>c.added).length})`,`class="${section==='channels'?'active':''}"`)}</div><div class="feed-layout"><aside class="feed-sidebar"><h3>Saved feeds</h3>${btn('all-feed','All channels',`class="${!feedId&&all?'active':''}"`)}${library.feeds.map(f=>btn('saved-feed',esc(f.name),`data-id="${esc(f.id)}" class="${feedId===f.id?'active':''}"`)).join('')}${library.feeds.length?'':'<p class="inline-note">Combine categories, then save that view here.</p>'}<h3>Your library</h3>${btn('discover-channels','Channels from playlists')}${btn('search-channels','Search YouTube')}</aside><div class="feed-main">${section==='feed'?feedMarkup(title,saved):channelsMarkup()}</div></div>`;sync();
 }
 function feedMarkup(title,saved){
  let videos=feedSource==='saved'?feedPlaylists.flatMap(id=>sourceCache.get(id)?.videos||[]):[...uploadCache.values()].flatMap(c=>c.videos);
  videos=categoryVideos(videos,library.channels,cats,{all});const error=parseSearch(feedQuery).error;videos=filterEntries(videos,feedQuery);
  if(feedSort==='title')videos.sort((a,b)=>a.title.localeCompare(b.title));else if(feedSort==='channel')videos.sort((a,b)=>a.channel.localeCompare(b.channel));else if(feedSource==='uploads')videos.sort((a,b)=>(b.publishedEstimate||0)-(a.publishedEstimate||0));
  feedPage=Math.min(feedPage,Math.max(0,Math.ceil(videos.length/20)-1));
  return `<div class="chips">${btn('category-chip','All',`class="chip ${all?'active':''}" data-id="all"`)}${library.categories.map(c=>btn('category-chip',esc(c.name),`data-id="${esc(c.id)}" class="chip ${!all&&cats.includes(c.id)?'active':''}"`)).join('')}</div><div class="feed-title"><h2>${esc(title)}</h2><div class="actions">${btn('save-feed',saved?'Edit feed':'Save this view')}${saved?btn('delete-feed','Delete feed'):''}</div></div><p class="inline-note">${chosenChannels().length} channels · Multiple categories include channels in any selected category.</p><div class="feed-toolbar"><select id="feed-source" aria-label="Feed source"><option value="uploads" ${feedSource==='uploads'?'selected':''}>Recent channel uploads</option><option value="saved" ${feedSource==='saved'?'selected':''}>Saved in playlists</option></select>${btn('refresh-feed','Refresh feed','data-requires-account')}${feedSource==='uploads'?btn('more-feed','Load more uploads','data-requires-account'):''}</div>${feedSource==='saved'?sourcePicker(feedPlaylists,'feed'):''}<div class="feed-toolbar"><input id="feed-query" type="search" autocomplete="off" placeholder="Filter these videos…" aria-label="Filter feed" value="${esc(feedQuery)}"><select id="feed-sort" aria-label="Sort feed"><option value="newest" ${feedSort==='newest'?'selected':''}>${feedSource==='uploads'?'Newest (approximate)':'Playlist order'}</option><option value="title" ${feedSort==='title'?'selected':''}>Title A–Z</option><option value="channel" ${feedSort==='channel'?'selected':''}>Channel A–Z</option></select></div><p id="feed-notice" role="status" class="inline-note">${esc(error||feedNotice||(feedSource==='uploads'?'Refresh to read recent uploads. YouTube controls page sizes; Load more reads the next page.':'Select playlists and refresh to load their videos.'))}</p><div class="feed-list">${videos.slice(feedPage*20,(feedPage+1)*20).map(videoMarkup).join('')||'<div class="empty">No videos in this view yet. Add channels, choose categories, then refresh.</div>'}</div><div class="feed-pagination"><span>${videos.length?`${feedPage*20+1}–${Math.min(videos.length,(feedPage+1)*20)} of ${videos.length}`:'0 videos'}</span><div class="actions">${btn('feed-prev','← Previous',feedPage===0?'disabled':'')}${btn('feed-next','Next →',(feedPage+1)*20>=videos.length?'disabled':'')}</div></div>`;
 }
 function videoMarkup(v){return `<article class="feed-video"><a href="${link(v.videoId)}" target="_blank" rel="noopener noreferrer"><img src="${thumb(v.videoId)}" alt="" loading="lazy" referrerpolicy="no-referrer"></a><div><h3><a href="${link(v.videoId)}" target="_blank" rel="noopener noreferrer">${esc(v.title)}</a></h3><small>${esc(v.channel)}${v.publishedText?` · ${esc(v.publishedText)}`:''}${typeof v.watchedPercent==='number'?` · ${v.watchedPercent}% played`:''}</small></div>${btn('save-video','+ Watch Later',`data-id="${esc(v.videoId)}" data-requires-account`)}</article>`;}
 function channelsMarkup(){
  let channels=channelMode==='search'?channelResults:channelMode==='playlists'?discoverChannels(sourceChoices.flatMap(id=>sourceCache.get(id)?.videos||[])):library.channels.filter(c=>c.added);
  channels=channels.map(c=>getChannel(c.id)||c).filter(c=>`${c.name} ${c.handle||''}`.toLowerCase().includes(channelQuery.toLowerCase())&&(channelCategory==='all'||(channelCategory==='none'?!c.cats.length:c.cats.includes(channelCategory))));
  channels.sort(channelSort==='saved'?(a,b)=>(b.savedCount||0)-(a.savedCount||0):(a,b)=>a.name.localeCompare(b.name));
  return `<div class="feed-toolbar">${btn('library-channels','Added channels',`class="${channelMode==='library'?'active':''}"`)}${btn('discover-channels','From playlists',`class="${channelMode==='playlists'?'active':''}"`)}${btn('search-channels','Search YouTube',`class="${channelMode==='search'?'active':''}"`)}</div>${channelMode==='search'?`<form data-form="channel-search" class="feed-toolbar"><input id="youtube-channel-query" type="search" autocomplete="off" placeholder="Search YouTube for channels…" aria-label="Search YouTube channels" value="${esc(searchQuery)}" required><button type="submit" class="primary" data-requires-account>Search</button></form>`:channelMode==='playlists'?`${sourcePicker(sourceChoices,'discover')}<div class="feed-toolbar">${btn('load-channel-sources','Load selected playlists','data-requires-account')}<span class="inline-note">Channels are discovered from the playlists you load.</span></div>`:''}<div class="feed-toolbar"><input id="channel-query" type="search" autocomplete="off" placeholder="Filter channels…" aria-label="Filter channels" value="${esc(channelQuery)}"><select id="channel-sort" aria-label="Sort channels"><option value="name" ${channelSort==='name'?'selected':''}>Name A–Z</option><option value="saved" ${channelSort==='saved'?'selected':''}>Most saved videos</option></select><select id="channel-category" aria-label="Channel category"><option value="all">All categories</option><option value="none" ${channelCategory==='none'?'selected':''}>Uncategorised</option>${library.categories.map(c=>`<option value="${esc(c.id)}" ${channelCategory===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="feed-toolbar"><strong>${channels.length} channels · ${channelSelected.size} selected</strong>${btn('select-channels','Select visible')}${btn('clear-channel-selection','Clear selection')}${btn('categorise-selected','Assign categories',channelSelected.size?'':'disabled')}</div><div class="channel-list">${channels.map(c=>`<article class="channel-row"><input type="checkbox" data-channel-check="${esc(c.id)}" aria-label="Select ${esc(c.name)}" ${channelSelected.has(c.id)?'checked':''}><div><h3>${esc(c.name)}</h3><p>${c.savedCount||0} saved videos${c.added?' · Added to My feeds':''}${c.handle?` · ${esc(c.handle)}`:''}</p>${(c.cats||[]).map(id=>`<span class="category-label">${esc(library.categories.find(x=>x.id===id)?.name||'')}</span>`).join('')}</div><div class="actions">${btn('browse-channel','Browse',`data-id="${esc(c.id)}"`)}${btn('categorise-channel',c.added?'Categories':'Add to feeds',`data-id="${esc(c.id)}"`)}${c.added?btn('remove-channel','Remove',`data-id="${esc(c.id)}"`):''}</div></article>`).join('')||'<div class="empty">No channels here yet. Search YouTube or load channels from your playlists.</div>'}</div>${channelMode==='search'&&channelToken?`<div class="feed-toolbar">${btn('more-channels','More channel results','data-requires-account')}</div>`:''}`;
 }
 async function fetchUploads(channel,more=false){
  const cached=uploadCache.get(channel.id);if(more&&cached&&!cached.token)return cached;
  if(!channelIdValid(channel.id))throw new Error(`${channel.name}: its channel ID is missing. Search YouTube and add the matching channel.`);
  let result;
  if(more&&cached?.token)result=await api.call('channel-browse',{channelId:channel.id,token:cached.token});
  else{const initial=await api.call('channel-browse',{channelId:channel.id});const command=channelVideosCommand(initial.data,channel.id);if(!command)throw new Error(`${channel.name}: YouTube did not expose a Videos tab. Shorts-only and live-only channels are not supported yet.`);result=await api.call('channel-browse',command);}
  const parsed=parseUploads(result.data,channel);if(more&&cached?.token&&parsed.token===cached.token)throw new Error('YouTube repeated a channel page.');
  const next={videos:more&&cached?[...new Map([...cached.videos,...parsed.videos].map(v=>[v.videoId,v])).values()]:parsed.videos,token:parsed.token};uploadCache.set(channel.id,next);return next;
 }
 async function refreshFeed(more=false){if(!ready())return;await api.exclusive(async()=>{
  const failures=[];if(feedSource==='saved'){
   for(const id of feedPlaylists){if(api.isStopped())break;await readPlaylist(id);}discover();await saveLibrary();feedNotice=`Loaded saved videos from ${feedPlaylists.length} playlists.`;
  }else{
   const channels=chosenChannels();if(!channels.length)throw new Error('Add channels to this category before refreshing.');
   for(let i=0;i<channels.length;i++){if(api.isStopped())break;api.message(`Loading channels: ${i+1}/${channels.length} · ${channels[i].name}`);try{await fetchUploads(channels[i],more);}catch(error){failures.push(error.message);if(/429/.test(error.message))break;}}
   feedNotice=`${api.isStopped()?'Stopped. ':''}${channels.filter(c=>uploadCache.has(c.id)).length}/${channels.length} channels loaded.${failures.length?' '+failures.join(' '):' Latest available pages shown.'}`;
  }renderFeeds();api.message(feedNotice,!!failures.length);
 });}
 async function searchChannels(more=false){if(!ready())return;const q=more?searchQuery:$('youtube-channel-query').value.trim();if(!q)return;searchQuery=q;await api.exclusive(async()=>{
  api.message(`Searching YouTube for “${q}”…`);const response=await api.call('channel-search',more?{token:channelToken}:{query:q});const parsed=parseChannelSearch(response.data);
  channelResults=more?[...new Map([...channelResults,...parsed.channels].map(c=>[c.id,c])).values()]:parsed.channels;channelToken=parsed.token;library.channels=mergeChannelLibrary(library.channels,channelResults);await saveLibrary();channelQuery='';renderFeeds();api.message(`${channelResults.length} channel results. Select categories to add them to My feeds.`);
 });}
 function categoryChecks(selected){return `<div class="category-options">${library.categories.map(c=>`<label><input name="categories" type="checkbox" value="${esc(c.id)}" ${selected.includes(c.id)?'checked':''}>${esc(c.name)}</label>`).join('')||'<p class="inline-note">Create your first category below.</p>'}</div>`;}
 function categorise(ids){
  const found=ids.map(getChannel).filter(Boolean);if(!found.length)return;const existing=found.length===1?found[0].cats:[];
  modal(found.length===1?`Categories for ${found[0].name}`:`Add categories to ${found.length} channels`,`<form data-form="categorise" data-ids="${esc(JSON.stringify(ids))}">${categoryChecks(existing)}<label class="dialog-field">New category<input name="newCategory" maxlength="100" autocomplete="off" placeholder="e.g. True crime"></label><p class="inline-note">${found.length===1?'Channels can belong to several categories. Saving adds this channel to My feeds.':'Chosen categories will be added to these channels. Existing categories are kept.'}</p><div class="dialog-footer">${btn('close-dialog','Cancel')}<button class="primary" type="submit">Save categories</button></div></form>`);
 }
 function manageCategories(){modal('Manage categories',`<div class="dialog-list">${library.categories.map(c=>`<div class="category-manager-row"><strong>${esc(c.name)}</strong><small>${library.channels.filter(ch=>ch.added&&ch.cats.includes(c.id)).length} channels</small>${btn('view-category-channels','View',`data-id="${esc(c.id)}"`)}${btn('rename-category','Rename',`data-id="${esc(c.id)}"`)}${btn('delete-category','Delete',`data-id="${esc(c.id)}"`)}</div>`).join('')}</div><form data-form="new-category" class="feed-toolbar"><input name="name" maxlength="100" required autocomplete="off" placeholder="New category name" aria-label="New category name"><button type="submit" class="primary">Create category</button></form>`);}
 function newCategory(name){name=name.trim();if(!name)return null;const old=library.categories.find(c=>c.name.toLowerCase()===name.toLowerCase());if(old)return old.id;const id=crypto.randomUUID();library.categories.push({id,name});return id;}
 function feedEditor(){const feed=library.feeds.find(f=>f.id===feedId);modal(feed?'Edit feed':'Save this view',`<form data-form="save-feed"><label class="dialog-field">Feed name<input name="name" maxlength="100" required autocomplete="off" value="${esc(feed?.name||'')}"></label><label><input name="all" type="checkbox" ${all?'checked':''}> Include all added channels</label><p class="inline-note">Or combine categories below. A channel in any chosen category is included.</p>${categoryChecks(cats)}<p class="inline-note">Source: ${feedSource==='saved'?'the currently selected playlists':'recent channel uploads'}. You can change this in the feed.</p><div class="dialog-footer">${btn('close-dialog','Cancel')}<button class="primary" type="submit">Save feed</button></div></form>`);}
 async function browseChannel(id,load=false){const channel=getChannel(id);if(!channel)return;dialogChannel=id;
  if(load&&ready())await api.exclusive(async()=>{api.message(`Reading ${channel.name} uploads…`);await fetchUploads(channel);});
  const saved=categoryVideos(allSaved(),[{...channel,added:true}],[],{all:true}),uploads=uploadCache.get(id)?.videos||[];
  modal(channel.name,`<p>${saved.length} saved videos · ${channelIdValid(id)?`<a href="https://www.youtube.com/channel/${esc(id)}" target="_blank" rel="noopener noreferrer">Open channel ↗</a>`:'Search YouTube to link this older cached channel to a channel ID.'}</p><div class="feed-toolbar">${btn('channel-saved','Saved videos',`class="${dialogSaved?'active':''}"`)}${btn('channel-uploads','Recent uploads',`class="${!dialogSaved?'active':''}"`)}${btn('load-channel-uploads','Load uploads',`data-requires-account ${channelIdValid(id)?'':'disabled data-blocked'}`)}</div><div class="dialog-list feed-list">${(dialogSaved?saved:uploads).map(videoMarkup).join('')||'<div class="empty">No videos loaded in this view.</div>'}</div>`);
 }
 async function saveVideo(id){if(!ready()||!/^[\w-]{11}$/.test(id))return;await api.exclusive(async()=>{
  api.message('Checking Watch Later before saving…');const present=await api.readDestination('WL','checking Watch Later');if(present.has(id)){api.message('This video is already in Watch Later.');return;}if(present.size>=5000)throw new Error('Watch Later is full. Remove some videos first.');
  const response=await api.call('restore',{playlistId:'WL',ids:[id]});api.confirmRemoval(response.data);const checked=await verifyDestinationVideos({ids:[id],read:()=>api.readDestination('WL','verifying saved video'),stopped:api.isStopped});if(checked.missing.length)throw new Error('YouTube accepted the request but has not shown the saved video yet. It will be checked before another save.');
  if(api.get().sourceId==='WL')await api.scan();else{const cached=sourceCache.get('WL');if(cached)cached.complete=false;}api.message('Saved to Watch Later.');
 });}
 async function settings(){
  const tabs=await chrome.tabs.query({url:'https://www.youtube.com/*'});
  modal('Connection & settings',`<p>Choose the YouTube tab and signed-in account this workspace should use.</p><label class="dialog-field">YouTube tab<select id="settings-tab">${tabs.map(t=>`<option value="${t.id}" ${api.get().tabId===t.id?'selected':''}>${esc(t.title||t.url)}</option>`).join('')}</select></label><div class="actions">${btn('settings-connect','Connect to selected tab',`${tabs.length?'':'disabled'} data-requires-account-independent`)}${btn('settings-disconnect','Disconnect')}</div><hr><h3>Feeds backup</h3><p class="settings-note">Export your categories, channel choices and saved feeds. This file contains your choices, so only share it if you intend to. Import replaces those definitions, not your YouTube playlists or removal history.</p><div class="actions">${btn('export-feeds','Export feeds','data-requires-account')}<label class="button">Import feeds<input id="import-feeds" type="file" accept=".json,application/json"></label></div><p class="settings-note">No analytics, tracking, AI API keys or contribution sharing. Data stays in this Chrome profile. Optional unavailable-video recovery asks permission to look up video IDs at the Internet Archive.</p>`);
 }
 $('settings-open').onclick=settings;
 function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function rerenderInput(id,fn){const el=$(id),pos=el?.selectionStart;fn();const next=$(id);next?.focus();if(pos!==null)next?.setSelectionRange?.(pos,pos);}
 document.addEventListener('input',e=>{
  const id=e.target.id;if(id==='feed-query')rerenderInput(id,()=>{feedQuery=e.target.value;feedPage=0;renderFeeds();});
  if(id==='channel-query')rerenderInput(id,()=>{channelQuery=e.target.value;renderFeeds();});
 });
 document.addEventListener('change',e=>{void(async()=>{
  const t=e.target;if(t.id==='feed-source'){feedSource=t.value;detach();renderFeeds();}if(t.id==='feed-sort'){feedSort=t.value;feedPage=0;renderFeeds();}
  if(t.id==='channel-sort'){channelSort=t.value;renderFeeds();}if(t.id==='channel-category'){channelCategory=t.value;renderFeeds();}
  if(t.dataset.source){const current=t.dataset.source==='feed'?feedPlaylists:sourceChoices;const next=t.checked?unique([...current,t.value]):current.filter(id=>id!==t.value);if(t.dataset.source==='feed'){feedPlaylists=next;detach();}else sourceChoices=next;renderFeeds();}
  if(t.dataset.channelCheck){if(t.checked)channelSelected.add(t.dataset.channelCheck);else channelSelected.delete(t.dataset.channelCheck);renderFeeds();}
  if(t.id==='import-feeds'){
   if(!ready())return;const file=t.files[0];if(!file)return;if(file.size>2e6)throw new Error('Choose an export smaller than 2 MB.');const data=validLibrary(JSON.parse(await file.text()));if(!confirm('Replace your saved feeds, channel choices and categories with this file? YouTube playlists will not change.'))return;library=data;await saveLibrary();cats=[];all=true;feedId=null;channelSelected.clear();dialog.close();renderFeeds();api.message('Feeds imported.');
  }
 })().catch(e=>api.message(e.message,true));});
 document.addEventListener('submit',e=>{const form=e.target;if(!form.dataset.form)return;e.preventDefault();void(async()=>{
  if(!ready())return;const data=new FormData(form);
  if(form.dataset.form==='channel-search'){await searchChannels();return;}
  if(form.dataset.form==='categorise'){const ids=JSON.parse(form.dataset.ids),selected=data.getAll('categories');const id=newCategory(String(data.get('newCategory')||''));if(id)selected.push(id);for(const id of ids){const c=getChannel(id);if(c){c.cats=ids.length===1?unique(selected):unique([...c.cats,...selected]);c.added=true;}}await saveLibrary();dialog.close();renderFeeds();}
  if(form.dataset.form==='new-category'){newCategory(String(data.get('name')||''));await saveLibrary();manageCategories();renderFeeds();}
  if(form.dataset.form==='rename-category'){const c=library.categories.find(c=>c.id===form.dataset.id),name=String(data.get('name')||'').trim();if(name&&c){if(library.categories.some(x=>x.id!==c.id&&x.name.toLowerCase()===name.toLowerCase()))throw new Error('A category with this name already exists.');c.name=name;await saveLibrary();manageCategories();renderFeeds();}}
  if(form.dataset.form==='save-feed'){const name=String(data.get('name')||'').trim(),chosen=data.getAll('categories'),includeAll=data.has('all');if(!includeAll&&!chosen.length)throw new Error('Select categories or include all channels.');if(!name)return;const f={id:feedId||crypto.randomUUID(),name,cats:chosen,all:includeAll,source:feedSource,playlists:[...feedPlaylists]};library.feeds=[...library.feeds.filter(x=>x.id!==f.id),f];feedId=f.id;cats=chosen;all=includeAll;await saveLibrary();dialog.close();renderFeeds();}
 })().catch(e=>api.message(e.message,true));});
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-ui]');if(!b||b.disabled)return;void(async()=>{
  const action=b.dataset.ui,id=b.dataset.id;
  if(action==='close-dialog'){if(!api.get().busy)dialog.close();return;}
  if(action==='settings-connect'){dialog.close();await api.connect(Number($('settings-tab')?.value));return;}
  if(action==='settings-disconnect'){api.disconnect();dialog.close();return;}
  if(api.get().busy)return;
  if(action==='open-playlist')return openPlaylist(id);
  if(action==='delete-playlist'){if(!ready())return;api.setDestinations(playlistList);api.askDeletePlaylist(playlistList.find(p=>p.id===id));return;}
  if(action==='feed-tab')section='feed';
  if(['channels-tab','library-channels'].includes(action)){section='channels';channelMode='library';}
  if(['add-channels','search-channels'].includes(action)){section='channels';channelMode='search';channelQuery='';channelCategory='all';}
  if(action==='discover-channels'){section='channels';channelMode='playlists';channelQuery='';channelCategory='all';if(ready()&&!playlistList.length)await refreshPlaylists();}
  if(action==='category-chip'){detach();if(id==='all'){all=true;cats=[];}else{all=false;cats=cats.includes(id)?cats.filter(x=>x!==id):[...cats,id];if(!cats.length)all=true;}}
  if(action==='all-feed'){section='feed';all=true;cats=[];feedId=null;feedPage=0;}
  if(action==='saved-feed'){const f=library.feeds.find(f=>f.id===id);if(f){section='feed';feedId=id;all=f.all;cats=[...f.cats];feedSource=f.source;feedPlaylists=[...f.playlists];feedPage=0;}}
  if(action==='refresh-feed')return refreshFeed();if(action==='more-feed')return refreshFeed(true);
  if(action==='feed-prev')feedPage--;if(action==='feed-next')feedPage++;
  if(action==='save-feed'){if(owner)feedEditor();return;}
  if(action==='delete-feed'){if(confirm('Delete this saved feed? Channels and playlists will be kept.')){library.feeds=library.feeds.filter(f=>f.id!==feedId);detach();await saveLibrary();}}
  if(action==='manage-categories'){manageCategories();return;}
  if(action==='rename-category'){const c=library.categories.find(c=>c.id===id);modal('Rename category',`<form data-form="rename-category" data-id="${esc(id)}"><label class="dialog-field">Name<input name="name" value="${esc(c.name)}" maxlength="100" required autocomplete="off"></label><button type="submit" class="primary">Save name</button></form>`);return;}
  if(action==='delete-category'){if(confirm('Delete this category? Channels stay in My feeds. Saved feeds lose this category.')){library=removeCategory(library,id);cats=cats.filter(x=>x!==id);if(!cats.length)all=true;detach();await saveLibrary();manageCategories();}}
  if(action==='view-category-channels'){section='channels';channelMode='library';channelCategory=id;channelQuery='';dialog.close();}
  if(action==='categorise-channel'){categorise([id]);return;}if(action==='categorise-selected'){categorise([...channelSelected]);return;}
  if(action==='select-channels')root.querySelectorAll('[data-channel-check]').forEach(c=>channelSelected.add(c.dataset.channelCheck));
  if(action==='clear-channel-selection')channelSelected.clear();
  if(action==='remove-channel'){const c=getChannel(id);if(c&&confirm(`Remove ${c.name} from My feeds? Saved YouTube videos will be kept.`)){c.added=false;channelSelected.delete(id);await saveLibrary();}}
  if(action==='more-channels')return searchChannels(true);
  if(action==='load-channel-sources'){if(!ready())return;await api.exclusive(async()=>{for(const id of sourceChoices){if(api.isStopped())break;await readPlaylist(id);}discover();await saveLibrary();api.message('Channels updated from the selected playlists.');});}
  if(action==='browse-channel'){dialogSaved=false;return browseChannel(id);}
  if(action==='load-channel-uploads')return browseChannel(dialogChannel,true);
  if(action==='channel-saved'){dialogSaved=true;return browseChannel(dialogChannel);}
  if(action==='channel-uploads'){dialogSaved=false;return browseChannel(dialogChannel);}
  if(action==='save-video')return saveVideo(id);
  if(action==='export-feeds'){download('watch-later-feeds.json',validLibrary(library));return;}
  renderFeeds();
 })().catch(e=>api.message(e.message,true));});
 renderPlaylists();renderFeeds();sync();
}
