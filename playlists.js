import {extractPlaylistTotal} from './counts.js';
export function editablePlaylists(data) {
 const found=new Map();
 function walk(value){
  if(!value||typeof value!=='object')return;
  const p=value.playlistAddToOptionRenderer;
  if(p?.playlistId&&p.playlistId!=='WL'&&p.playlistId!=='LL'&&!p.isDisabled){
   const title=p.title?.simpleText||(p.title?.runs||[]).map(r=>r.text).join('');
   const raw=p.videoCount;
   const videoCount=Number.isSafeInteger(raw)&&raw>=0?raw:extractPlaylistTotal({playlistHeaderRenderer:{numVideosText:p.videoCountText||p.numVideosText||(typeof raw==='string'?{simpleText:raw}:null)}});
   if(title)found.set(p.playlistId,{id:p.playlistId,title,videoCount});
  }
  for(const child of Object.values(value))walk(child);
 }
 walk(data);return [...found.values()];
}
// Both HTTP success and the explicit mutation status are checked by callers.
export async function copyThenRemove({add,verify,remove,ids}) {
 if(ids.length){await add(ids);await verify(ids);}
 await remove();
}

// Empty destinations can use a message instead of a playlistVideoListRenderer.
// Only accept explicit empty messages in the selected browse tab, never sidebars.
export function emptyDestination(data) {
 let hasError=false;
 function errors(value){
  if(!value||typeof value!=='object')return;
  if(value.error || value.alertRenderer?.type==='ERROR' || value.alertWithButtonRenderer?.type==='ERROR')hasError=true;
  Object.values(value).forEach(errors);
 }
 errors(data);if(hasError)return false;
 const tabs=data?.contents?.twoColumnBrowseResultsRenderer?.tabs || data?.contents?.singleColumnBrowseResultsRenderer?.tabs || [];
 const selected=tabs.find(t=>t.tabRenderer?.selected===true)?.tabRenderer?.content;
 if(!selected)return false;
 let empty=false,hasEntries=false,hasContinuation=false;
 function walk(value){
  if(!value||typeof value!=='object')return;
  if(value.playlistVideoRenderer || value.videoRenderer || value.lockupViewModel)hasEntries=true;
  if(Object.keys(value).some(key=>/continuation/i.test(key)))hasContinuation=true;
  const text=value.messageRenderer?.text;
  const message=(text?.simpleText||(text?.runs||[]).map(r=>r.text||'').join('')).trim();
  if(/^(?:this playlist (?:has no|doesn[’']t have any) videos(?: yet)?|there are no videos in this playlist(?: yet)?|no videos in this playlist|this playlist is empty)[.!]?$/i.test(message))empty=true;
  Object.values(value).forEach(walk);
 }
 walk(selected);return empty&&!hasEntries&&!hasContinuation;
}

// Keys only: no session values, video names, IDs, or continuation tokens.
export function playlistStructure(data){
 const paths=[];
 function walk(value,path='',depth=0){
  if(!value||typeof value!=='object'||depth>25||paths.length>=180)return;
  for(const [key,child] of Object.entries(value)){
   if(['context','responseContext','trackingParams','clickTrackingParams','frameworkUpdates'].includes(key))continue;
   const next=path+'/'+(/^\d+$/.test(key)?'*':key);
   if(/Renderer$|ViewModel$|Command$|Action$|^contents$|^tabs$|^error$/.test(key))paths.push(next);
   walk(child,next,depth+1);
  }
 }
 walk(data);return [...new Set(paths)];
}

// Retry reads only. Never resend an add request after an uncertain result.
export async function verifyDestinationVideos({ids,read,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),onRetry=()=>{},stopped=()=>false}){
 let present=new Set();
 for(let attempt=0;attempt<4;attempt++){
  if(stopped())throw new Error('Stopped before destination verification completed.');
  if(attempt){onRetry(attempt);await wait([0,400,1000,2000][attempt]);}
  if(stopped())throw new Error('Stopped before destination verification completed.');
  present=await read();
  if(ids.every(id=>present.has(id)))return {present,missing:[]};
 }
 return {present,missing:ids.filter(id=>!present.has(id))};
}
