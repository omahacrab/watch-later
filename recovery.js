const validId=id=>/^[A-Za-z0-9_-]{11}$/.test(id);
const text=v=>v?.simpleText||(v?.runs||[]).map(r=>r.text||'').join('');
const useful=t=>typeof t==='string'&&t.trim()&&!/^(?:\[?(?:deleted|private|unavailable) video\]?|youtube)$/i.test(t.trim());
// Parse JSON literals only; archived HTML and scripts are never executed.
function embeddedJSON(html,name){
 const patterns=[`var ${name} =`, `var ${name}=`, `window["${name}"] =`, `window['${name}'] =`];
 for(const pattern of patterns){
  const at=html.indexOf(pattern);if(at<0)continue;
  const start=html.indexOf('{',at+pattern.length);if(start<0)continue;
  let depth=0,string=false,escape=false;
  for(let i=start;i<html.length;i++){
   const c=html[i];
   if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;continue;}
   if(c==='"')string=true;else if(c==='{')depth++;else if(c==='}'&&!--depth){try{return JSON.parse(html.slice(start,i+1));}catch{break;}}
  }
 }
 return null;
}
export function archivedDetails(html,id){
 const player=embeddedJSON(html,'ytInitialPlayerResponse');
 const details=player?.videoDetails;
 if(details?.videoId===id&&useful(details.title))return {title:details.title,channel:details.author||'',channelId:details.channelId||''};
 const data=embeddedJSON(html,'ytInitialData');
 const current=data?.currentVideoEndpoint?.watchEndpoint?.videoId;
 if(current&&current!==id)return null;
 const contents=data?.contents?.twoColumnWatchNextResults?.results?.results?.contents||[];
 const primary=contents.find(v=>v.videoPrimaryInfoRenderer)?.videoPrimaryInfoRenderer;
 const secondary=contents.find(v=>v.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer;
 const title=text(primary?.title);if(!useful(title))return null;
 const owner=secondary?.owner?.videoOwnerRenderer;
 return {title,channel:text(owner?.title),channelId:owner?.navigationEndpoint?.browseEndpoint?.browseId||owner?.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId||'',published:text(primary?.dateText)};
}
export function applyRecovered(videos,cache={}){
 return videos.map(v=>{
  const detail=cache[v.videoId];
  if(!v.unavailable||!detail||!useful(detail.title))return v;
  return {...v,title:detail.title,channel:detail.channel||v.channel,channels:detail.channel?[{id:detail.channelId||'',name:detail.channel}]:v.channels,recovered:detail};
 });
}
export async function recoverDetails(id,{fetcher=fetch,signal,onStage=()=>{}}={}){
 if(!validId(id))throw new Error('This entry has no usable video ID.');
 const get=async(url,json=true)=>{
  signal?.throwIfAborted();
  const response=await fetcher(url,{credentials:'omit',cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
  if(response.status===429)throw new Error('Rate limited. Recovery stopped; try again later.');
  if(!response.ok){
   if(url.startsWith('https://web.archive.org/')&&response.status!==404)throw new Error(`Archive request failed (HTTP ${response.status}). Try again later.`);
   return null;
  }
  if(json)return response.json();
  const body=await response.text();if(body.length>6000000)throw new Error('Archived page is too large.');return body;
 };
 onStage('Checking YouTube');
 let live=null;
 try{live=await get(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v='+id)}&format=json`);}catch(error){if(signal?.aborted||/Rate limited/.test(error.message))throw error;}
 if(useful(live?.title))return {title:live.title,channel:live.author_name||'',channelId:'',source:'youtube',sourceUrl:`https://www.youtube.com/watch?v=${id}`,recoveredAt:Date.now()};
 onStage('Looking for archived pages');
 const cdx=await get(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent('youtube.com/watch?v='+id)}&output=json&filter=statuscode:200&filter=mimetype:text/html&collapse=digest&filter=!digest:-&limit=-8`);
 if(!Array.isArray(cdx)||cdx.length<2)return null;
 const header=cdx[0];const ti=header.indexOf('timestamp'),oi=header.indexOf('original');
 if(ti<0||oi<0)return null;
 let tried=0;
 for(const row of cdx.slice(1).reverse()){
  const timestamp=row[ti];let original;
  try{original=new URL(row[oi]);}catch{continue;}
  if(!/^\d{14}$/.test(timestamp)||!['youtube.com','www.youtube.com','m.youtube.com'].includes(original.hostname)||original.pathname!=='/watch'||original.searchParams.get('v')!==id)continue;
  if(++tried>3)break;
  onStage(`Reading archive ${tried}/3`);
  const sourceUrl=`https://web.archive.org/web/${timestamp}/${original.href}`;
  const html=await get(`https://web.archive.org/web/${timestamp}id_/${original.href}`,false);
  const details=html&&archivedDetails(html,id);
  if(details)return {...details,source:'archive',sourceUrl,archivedAt:timestamp,recoveredAt:Date.now()};
 }
 return null;
}

export function recoverHistoryDetails(history=[],cache={}){
 return history.map(item=>{
  const video=item.video;
  if(!video)return item;
  const metadata=cache[video.videoId]||video.recovered;
  if(!metadata)return item;
  // Older snapshots may have a placeholder title without an unavailable flag.
  const placeholder=/^\[?(?:deleted|private|unavailable) video\]?$/i.test(video.title||'');
  const restored=applyRecovered([{...video,unavailable:video.unavailable||placeholder}],{[video.videoId]:metadata})[0];
  return {...item,video:restored};
 });
}
