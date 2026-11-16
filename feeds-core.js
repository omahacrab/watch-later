import {textOf} from './core.js';
import {channelIndex,channelsFor,extractChannels} from './channels.js';
import {watchProgress} from './search-pills.js';
export const channelIdValid=id=>/^UC[a-zA-Z0-9_-]{22}$/.test(id||'');
const walk=(v,fn)=>{if(!v||typeof v!=='object')return;fn(v);for(const child of Object.values(v))walk(child,fn);};
const nameKey=s=>String(s||'').normalize('NFKC').trim().toLowerCase();
export function mainContent(data){
 const search=data?.contents?.twoColumnSearchResultsRenderer?.primaryContents;if(search)return search;
 const browse=data?.contents?.twoColumnBrowseResultsRenderer||data?.contents?.singleColumnBrowseResultsRenderer;
 if(browse)return (browse.tabs||[]).map(t=>t.tabRenderer).find(t=>t?.selected)?.content||{};
 return data?.onResponseReceivedActions||data?.onResponseReceivedCommands||data?.continuationContents||data?.contents||data;
}
function checked(data){
 if(data?.error)throw new Error(data.error.message||'YouTube returned an error.');
 walk(data,v=>{if(v.alertRenderer?.type==='ERROR')throw new Error(textOf(v.alertRenderer.text)||'YouTube returned an error.');});
 return mainContent(data);
}
function continuation(data){
 const tokens=new Set();walk(data,v=>{if(v.continuationItemRenderer)walk(v.continuationItemRenderer,x=>{if(x.continuationCommand?.token)tokens.add(x.continuationCommand.token);});if(v.nextContinuationData?.continuation)tokens.add(v.nextContinuationData.continuation);});
 if(tokens.size>1)throw new Error('YouTube returned multiple feed continuations. Refresh this view.');return [...tokens][0]||null;
}
export function parseChannelSearch(data){
 const content=checked(data),found=new Map();walk(content,v=>{const c=v.channelRenderer;if(!c||!channelIdValid(c.channelId))return;found.set(c.channelId,{id:c.channelId,name:textOf(c.title),handle:textOf(c.subscriberCountText),description:textOf(c.descriptionSnippet),cats:[],added:false});});
 return {channels:[...found.values()],token:continuation(content)};
}
export function channelVideosCommand(data,channelId){
 checked(data);const browse=data?.contents?.twoColumnBrowseResultsRenderer||data?.contents?.singleColumnBrowseResultsRenderer;
 for(const t of browse?.tabs||[]){const tab=t.tabRenderer;if(!tab)continue;const e=tab.endpoint,b=e?.browseEndpoint,url=e?.commandMetadata?.webCommandMetadata?.url||'';
  if((/\/videos(?:[/?]|$)/.test(url)||/^videos$/i.test(tab.title||''))&&b?.browseId===channelId&&typeof b.params==='string')return {channelId,params:b.params};
 }
 return null;
}
export function publicationEstimate(text,now=Date.now()){
 const m=String(text||'').match(/(?:^|\s)(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago\b/i);if(!m)return null;
 return now-Number(m[1])*({second:1000,minute:60000,hour:3600000,day:86400000,week:604800000,month:2629800000,year:31557600000}[m[2].toLowerCase()]);
}
export function parseUploads(data,channel,now=Date.now()){
 const content=checked(data),found=new Map();walk(content,v=>{
  const r=v.videoRenderer||v.gridVideoRenderer;
  if(r?.videoId){const channels=extractChannels(r),publishedText=textOf(r.publishedTimeText);found.set(r.videoId,{key:r.videoId,videoId:r.videoId,title:textOf(r.title)||'Untitled video',channel:textOf(r.shortBylineText)||channel.name,channels:channels.length?channels:[{id:channel.id,name:channel.name}],channelId:channel.id,duration:textOf(r.lengthText),watchedPercent:watchProgress(r),publishedText,publishedEstimate:publicationEstimate(publishedText,now)});}
  const l=v.lockupViewModel;if(l?.contentType==='LOCKUP_CONTENT_TYPE_VIDEO'&&/^[\w-]{11}$/.test(l.contentId||'')){
   const meta=l.metadata?.lockupMetadataViewModel;const parts=[];walk(meta?.metadata,v=>{if(typeof v.content==='string')parts.push(v.content);});const publishedText=parts.find(t=>/ago\b/.test(t))||'';
   found.set(l.contentId,{key:l.contentId,videoId:l.contentId,title:meta?.title?.content||'Untitled video',channel:channel.name,channels:[{id:channel.id,name:channel.name}],channelId:channel.id,duration:'',watchedPercent:null,publishedText,publishedEstimate:publicationEstimate(publishedText,now)});
  }
 });return {videos:[...found.values()],token:continuation(content)};
}
export function discoverChannels(videos){
 const index=channelIndex(videos),found=new Map();for(const video of videos)for(const c of channelsFor(video,index)){
  const id=c.id||`name:${nameKey(c.name)}`;if(!found.has(id))found.set(id,{...c,id,name:c.name,cats:[],added:false,savedCount:0,videoIds:[]});const item=found.get(id);if(video.videoId&&!item.videoIds.includes(video.videoId)){item.videoIds.push(video.videoId);item.savedCount++;}
 }return [...found.values()];
}
export function mergeChannelLibrary(previous,incoming){
 const map=new Map(previous.map(c=>[c.id,{...c}]));for(const c of incoming){const old=map.get(c.id);map.set(c.id,old?{...old,...c,cats:old.cats||[],added:old.added||false,name:c.name||old.name}:{...c,cats:c.cats||[],added:c.added||false});}return [...map.values()];
}
export function categoryVideos(videos,channels,cats,{all=false}={}){
 const chosen=channels.filter(c=>c.added&&(all||c.cats?.some(id=>cats.includes(id)))),index=channelIndex(videos),seen=new Set();return videos.filter(v=>{
  if(seen.has(v.videoId))return false;const matches=channelsFor(v,index).some(c=>chosen.some(s=>channelIdValid(s.id)&&c.id?s.id===c.id:nameKey(s.name)===nameKey(c.name)));if(matches)seen.add(v.videoId);return matches;
 });
}
export function removeCategory(library,id){return {...library,categories:library.categories.filter(c=>c.id!==id),channels:library.channels.map(c=>({...c,cats:(c.cats||[]).filter(x=>x!==id)})),feeds:library.feeds.map(f=>({...f,cats:(f.cats||[]).filter(x=>x!==id)}))};}
export function validLibrary(data){
 if(!data||!Array.isArray(data.categories)||!Array.isArray(data.channels)||!Array.isArray(data.feeds))throw new Error('Choose a feeds export from this extension.');
 if(data.categories.length>500||data.channels.length>10000||data.feeds.length>500)throw new Error('This export is too large.');
 const str=(s,max)=>typeof s==='string'&&s.length>0&&s.length<=max;
 if(data.categories.some(c=>!str(c.id,100)||!str(c.name,100)))throw new Error('Invalid category data.');
 if(new Set(data.categories.map(c=>c.id)).size!==data.categories.length)throw new Error('Duplicate category IDs.');
 const ids=new Set(data.categories.map(c=>c.id));
 const cats=v=>Array.isArray(v)&&v.every(x=>ids.has(x));
 if(data.channels.some(c=>!str(c.id,250)||!str(c.name,300)||!cats(c.cats)||typeof c.added!=='boolean'||(!channelIdValid(c.id)&&!c.id.startsWith('name:'))))throw new Error('Invalid channel data.');
 if(data.feeds.some(f=>!str(f.id,100)||!str(f.name,100)||!cats(f.cats)||typeof f.all!=='boolean'||!['uploads','saved'].includes(f.source)||!Array.isArray(f.playlists)||f.playlists.some(p=>p!=='WL'&&!/^PL[\w-]+$/.test(p))))throw new Error('Invalid saved feed data.');
 return {categories:data.categories.map(c=>({id:c.id,name:c.name})),channels:data.channels.map(c=>({id:c.id,name:c.name,cats:c.cats,added:c.added})),feeds:data.feeds.map(f=>({id:f.id,name:f.name,cats:f.cats,all:f.all,source:f.source,playlists:f.playlists}))};
}
