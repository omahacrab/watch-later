export const selectableVideo = v => !!(v.setVideoId || (v.source === 'youtube-history' && v.videoId));
export function selectRange(selected, matches, anchor, target, shift, checked) {
 const index = matches.findIndex(v=>v.key===target);
 const start = matches.findIndex(v=>v.key===anchor);
 if(shift && start>=0 && index>=0) {
   for(const v of matches.slice(Math.min(start,index),Math.max(start,index)+1)) if(selectableVideo(v)) selected.add(v.key);
 } else if(checked) selected.add(target); else selected.delete(target);
 return target;
}
