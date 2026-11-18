// Local visual QA only. No real YouTube requests or user data.

const A='UC'+'a'.repeat(22),B='UC'+'b'.repeat(22);
const titles=['Feynman: Mirrors FUN TO IMAGINE 6','Will 2021 F1 war put Mercedes and Red Bull on the back foot in 2022?','Shocking Bodycam: Doctor’s Wife Discovered After Missing Husband','How to make the perfect tomato sauce','The Inescapable US China Rivalry','The next generation of electric cars'];
let cache={'feeds:fixture':{categories:[{id:'sport',name:'Sports'},{id:'crime',name:'True crime'},{id:'learn',name:'Learning'}],channels:[{id:A,name:'The Race',cats:['sport'],added:true},{id:B,name:'Law&Crime Network',cats:['crime'],added:true}],feeds:[{id:'news',name:'Weekend viewing',all:false,cats:['sport','learn'],source:'uploads',playlists:['WL']}]}};
const rows=Array.from({length:36},(_,i)=>({setVideoId:'set'+i,videoId:'aaaaaaaaaa'+(i%9),title:{simpleText:titles[i%titles.length]},shortBylineText:{runs:[{text:i%2?'Law&Crime Network':'The Race',navigationEndpoint:{browseEndpoint:{browseId:i%2?B:A}}}]},lengthText:{simpleText:'12:30'},thumbnailOverlays:[{thumbnailOverlayResumePlaybackRenderer:{percentDurationWatched:i%3?48:100}}]}));
const names=['Things worth understanding','Kitchen notebook','True crime','Sunday watching','F1 & motorsport'];
window.chrome={storage:{local:{get:async k=>structuredClone(k===null?cache:Array.isArray(k)?Object.fromEntries(k.map(x=>[x,cache[x]])):{[k]:cache[k]}),set:async o=>Object.assign(cache,structuredClone(o)),remove:async k=>delete cache[k]}},tabs:{query:async()=>[{id:1,title:'Watch Later - YouTube',url:'https://www.youtube.com/playlist?list=WL'}]},scripting:{executeScript:async({args:[op,p]})=>{
 const out=d=>[{result:{ok:true,data:d}}];if(op==='identity')return [{result:{ok:true,account:'fixture'}}];if(op==='page-data')return out({});
 if(op==='playlists')return out({addToPlaylistRenderer:{playlists:names.map((n,i)=>({playlistAddToOptionRenderer:{playlistId:'PL_'+i,title:{simpleText:n},videoCount:i*12}}))}});
 if(op==='browse'&&p.playlistId==='FEhistory')return out({sectionListRenderer:{contents:[{itemSectionRenderer:{contents:rows.map(videoRenderer=>({videoRenderer}))}}]}});
 if(op==='browse')return out({playlistHeaderRenderer:{numVideosText:{simpleText:p.playlistId==='WL'?'4,809 videos':'24 videos'}},playlistVideoListRenderer:{contents:rows.map(playlistVideoRenderer=>({playlistVideoRenderer}))}});
 if(op==='channel-browse')return p.params?out({contents:{twoColumnBrowseResultsRenderer:{tabs:[{tabRenderer:{selected:true,content:{contents:rows.slice(0,8).map(v=>({videoRenderer:{...v,publishedTimeText:{simpleText:'1 day ago'}}}))}}}]}}}):out({contents:{twoColumnBrowseResultsRenderer:{tabs:[{tabRenderer:{title:'Videos',endpoint:{browseEndpoint:{browseId:p.channelId,params:'videos'}}}}]}}});
 if(op==='create-playlist'){const id='PL_'+names.length;names.push(p.title);return out({playlistId:id});}
 if(['remove','restore','add-to-playlist'].includes(op))return out({status:'STATUS_SUCCEEDED'});
 return out({});
}}};

// Test-only thumbnails. This fixture is excluded from extension packages.
const paint=()=>document.querySelectorAll('.video-thumbnail img,.feed-video img').forEach(img=>{if(img.dataset.fixture)return;img.dataset.fixture='true';img.src='fixture-thumb.svg';});
new MutationObserver(paint).observe(document.documentElement,{childList:true,subtree:true});
