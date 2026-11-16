export function splitPills(text) {
 const complete=[];let start=0,quoted=false;
 for(let i=0;i<text.length;i++){
  if(['"','“','”'].includes(text[i]))quoted=!quoted;
  if(text[i]===','&&!quoted){const term=text.slice(start,i).trim();if(term)complete.push(term);start=i+1;}
 }
 return {complete,tail:text.slice(start)};
}
export function watchProgress(renderer) {
 for(const overlay of renderer.thumbnailOverlays || []){
  const value=overlay.thumbnailOverlayResumePlaybackRenderer?.percentDurationWatched;
  if(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100)return value;
 }
 return null;
}
export function watchMatches(video,filter) {
 const p=video.watchedPercent;
 if(!filter||filter==='all')return true;
 if(filter==='complete')return p===100;
 if(filter==='partial')return typeof p==='number'&&p>0&&p<100;
 if(filter==='any')return typeof p==='number'&&p>0;
 return p==null||p===0;
}
