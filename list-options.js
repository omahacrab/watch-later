const text = v => typeof v==='string'?v:v?.simpleText||(v?.runs||[]).map(r=>r.text||'').join('')||'';
export function playlistOptions(data) {
 const sorts=[];let unavailable=null,alreadyShown=false,activeSort=null;
 function endpoint(value){
  if(!value||typeof value!=='object')return null;
  const b=value.browseEndpoint;
  if(b && (!b.browseId||b.browseId==='VLWL') && typeof b.params==='string')return {params:b.params};
  if(typeof value.continuationCommand?.token==='string')return {token:value.continuationCommand.token};
  for(const child of Object.values(value)){const found=endpoint(child);if(found)return found;}
  return null;
 }
 function walk(value){
  if(!value||typeof value!=='object')return;
  for(const item of value.sortFilterSubMenuRenderer?.subMenuItems || []){
   const command=endpoint(item);const title=text(item.title);
   if(item.selected===true && title)activeSort=title;
   if(title&&command&&!sorts.some(s=>s.title===title))sorts.push({title,command});
  }
  for(const key of ['menuNavigationItemRenderer','menuServiceItemRenderer']){
   const item=value[key];if(!item)continue;
   const label=text(item.text);
   if(/show unavailable videos/i.test(label))unavailable=endpoint(item)||unavailable;
   if(/hide unavailable videos/i.test(label))alreadyShown=true;
  }
  for(const child of Object.values(value))walk(child);
 }
 walk(data);return {sorts,unavailable,alreadyShown,activeSort};
}
export function unavailableVideo(v) {
 const title=text(v.title).trim();
 return v.isPlayable===false || !v.videoId || /^\[?(?:private|deleted|unavailable) video\]?$/i.test(title);
}
function seconds(text) {
 if(!/^\d+(?::\d+){1,2}$/.test(text||''))return null;
 return text.split(':').reduce((n,part)=>n*60+Number(part),0);
}
export function sortVideos(videos,sort) {
 const result=[...videos];
 if(sort==='reverse')return result.reverse();
 if(sort==='title')return result.sort((a,b)=>a.title.localeCompare(b.title,undefined,{sensitivity:'base'}));
 if(sort==='channel')return result.sort((a,b)=>a.channel.localeCompare(b.channel,undefined,{sensitivity:'base'})||a.title.localeCompare(b.title));
 if(sort==='shortest'||sort==='longest')return result.sort((a,b)=>{
  const x=seconds(a.duration),y=seconds(b.duration);
  if(x===null)return y===null?0:1;if(y===null)return -1;
  return sort==='shortest'?x-y:y-x;
 });
 return result;
}
