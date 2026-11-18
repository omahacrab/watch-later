import {textOf} from './core.js';
import {extractChannels} from './channels.js';
import {watchProgress} from './search-pills.js';
import {mainContent} from './feeds-core.js';

const walk=(value,visit)=>{if(!value||typeof value!=='object')return;visit(value);for(const child of Object.values(value))walk(child,visit);};
// History is a browse feed, not an editable playlist. Never invent removal IDs.
export function parseWatchHistory(data){
 if(data?.error)throw new Error(data.error.message||'Could not load YouTube History.');
 walk(data,v=>{if(v.alertRenderer?.type==='ERROR')throw new Error(textOf(v.alertRenderer.text)||'Could not load YouTube History.');});
 const content=mainContent(data),videos=new Map(),tokens=new Set();
 let recognized=false,markers=0;
 const add=v=>{if(/^[\w-]{11}$/.test(v.videoId)&&!videos.has(v.videoId))videos.set(v.videoId,{...v,key:`history:${v.videoId}`,setVideoId:'',source:'youtube-history',unavailable:false});};
 walk(content,v=>{
  if(v.sectionListRenderer||v.sectionListContinuation||v.itemSectionRenderer||v.itemSectionContinuation||v.richGridRenderer||v.appendContinuationItemsAction||v.reloadContinuationItemsCommand||v.messageRenderer)recognized=true;
  const r=v.videoRenderer||v.gridVideoRenderer;
  if(r){recognized=true;const channels=extractChannels(r);add({videoId:r.videoId,title:textOf(r.title)||'Untitled video',channel:textOf(r.shortBylineText)||textOf(r.longBylineText)||textOf(r.ownerText),channels,duration:textOf(r.lengthText),watchedPercent:watchProgress(r)});}
  const l=v.lockupViewModel;
  if(l?.contentType==='LOCKUP_CONTENT_TYPE_VIDEO'){
   recognized=true;const meta=l.metadata?.lockupMetadataViewModel;const channels=new Map();
   walk(meta?.metadata,x=>{if(typeof x.content!=='string')return;walk(x,y=>{const e=y.onTap?.innertubeCommand?.browseEndpoint||y.navigationEndpoint?.browseEndpoint;if(/^UC[\w-]{22}$/.test(e?.browseId||''))channels.set(e.browseId,{id:e.browseId,name:x.content});});});
   let duration='';walk(l.contentImage,x=>{if(x.thumbnailOverlayBadgeViewModel)walk(x.thumbnailOverlayBadgeViewModel,b=>{if(typeof b.text==='string'&&/^\d+(?::\d{2}){1,2}$/.test(b.text))duration=b.text;});});
   add({videoId:l.contentId,title:meta?.title?.content||'Untitled video',channels:[...channels.values()],channel:[...channels.values()].map(c=>c.name).join(' & '),duration,watchedPercent:null});
  }
  const short=v.shortsLockupViewModel;if(short){recognized=true;add({videoId:short.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId,title:short.overlayMetadata?.primaryText?.content||'Short',channel:'',channels:[],duration:'',watchedPercent:null});}
  if(v.continuationItemRenderer){markers++;walk(v.continuationItemRenderer,x=>{if(x.continuationCommand?.token)tokens.add(x.continuationCommand.token);});}
  if(v.nextContinuationData?.continuation)tokens.add(v.nextContinuationData.continuation);
 });
 if(!recognized)throw new Error('YouTube returned an unfamiliar History format. Open History on YouTube or refresh to retry.');
 if(tokens.size>1)throw new Error('YouTube returned multiple History continuations. Refresh to retry.');
 const token=[...tokens][0]||null;
 return {videos:[...videos.values()],token,suspiciousEnd:markers>0&&!token};
}
