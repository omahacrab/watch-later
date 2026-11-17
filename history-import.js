// Only import user-facing removal records, never authentication or pending actions.
export function parseHistoryExport(data){
 if(!data||!Array.isArray(data.history)||data.history.length>100000)throw new Error('Choose a removal-history export from Watch Later.');
 const text=(v,n)=>typeof v==='string'?v.slice(0,n):'';
 const time=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
 return data.history.map(h=>{
  if(!h||typeof h.historyId!=='string'||!h.historyId||h.historyId.length>200||!time(h.removedAt)||!h.video||typeof h.video!=='object')throw new Error('This file contains an invalid history entry. Nothing imported.');
  const sourceId=h.sourceId||'WL';if(sourceId!=='WL'&&!/^PL[\w-]+$/.test(sourceId))throw new Error('Invalid source playlist. Nothing imported.');
  const v=h.video,id=v.videoId||null;if(id!==null&&!/^[\w-]{11}$/.test(id))throw new Error('Invalid video ID. Nothing imported.');
  if(h.restoredAt!=null&&!time(h.restoredAt))throw new Error('Invalid restoration date. Nothing imported.');
  const video={key:text(v.key,250),setVideoId:text(v.setVideoId,250),videoId:id,title:text(v.title,2000)||'Unavailable video',channel:text(v.channel,1000),duration:text(v.duration,100),unavailable:!!v.unavailable};
  if(Number.isFinite(v.watchedPercent)&&v.watchedPercent>=0&&v.watchedPercent<=100)video.watchedPercent=v.watchedPercent;
  if(v.recovered&&typeof v.recovered==='object'){
   const r=v.recovered;video.recovered={title:text(r.title,2000),channel:text(r.channel,1000),source:r.source==='archive'?'archive':'youtube',recoveredAt:time(r.recoveredAt)?r.recoveredAt:h.removedAt};
   try{const url=new URL(r.sourceUrl);if(url.protocol==='https:'&&['web.archive.org','www.youtube.com','youtube.com'].includes(url.hostname)&&!url.username&&!url.password)video.recovered.sourceUrl=url.href;}catch{}
  }
  return {historyId:h.historyId,sourceId,sourceTitle:text(h.sourceTitle,300)||'Watch Later',video,removedAt:h.removedAt,outcome:text(h.outcome,200)||'Imported removal',restoredAt:h.restoredAt||null};
 });
}
