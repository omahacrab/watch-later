import test from 'node:test';
import assert from 'node:assert/strict';
import {archivedDetails,applyRecovered,recoverDetails} from '../recovery.js';
const id='xvHVjnGMYL4';
const html=(title='Recovered title')=>'var ytInitialData = '+JSON.stringify({currentVideoEndpoint:{watchEndpoint:{videoId:id}},contents:{twoColumnWatchNextResults:{results:{results:{contents:[{videoPrimaryInfoRenderer:{title:{runs:[{text:title}]},dateText:{simpleText:'Sep 23, 2026'}}},{videoSecondaryInfoRenderer:{owner:{videoOwnerRenderer:{title:{runs:[{text:'Example'}]},navigationEndpoint:{browseEndpoint:{browseId:'UC_example'}}}}}}]}}}}})+';';
test('archived primary details are parsed without executing scripts or using recommendations',()=>{
 assert.equal(archivedDetails(html('Title with } and " braces'),id).title,'Title with } and " braces');
 assert.equal(archivedDetails(html(),id).channelId,'UC_example');
 assert.equal(archivedDetails(html(),'differentId'),null);
 assert.equal(archivedDetails('var ytInitialData = {malformed};',id),null);
 assert.equal(archivedDetails('window.hacked=true;'+html(),id).title,'Recovered title');
 assert.equal(globalThis.hacked,undefined);
});
test('recovered metadata preserves unavailable status and removal IDs across refreshes',()=>{
 const videos=[{videoId:id,title:'Deleted video',unavailable:true,key:'k',setVideoId:'entry',channels:[]}];
 const detail={title:'Known title',channel:'Example',channelId:'UC1',source:'archive'};
 const result=applyRecovered(videos,{[id]:detail});
 assert.equal(result[0].unavailable,true);assert.equal(result[0].setVideoId,'entry');assert.equal(result[0].key,'k');
 assert.equal(result[0].title,'Known title');assert.equal(result[0].channels[0].id,'UC1');
 assert.equal(videos[0].title,'Deleted video');
 assert.equal(applyRecovered([{...videos[0],unavailable:false}],{[id]:detail})[0].title,'Deleted video');
});
test('YouTube metadata avoids archive requests and sends no cookies',async()=>{
 const requests=[];
 const result=await recoverDetails(id,{fetcher:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({title:'Title',author_name:'Channel'})};}});
 assert.equal(result.source,'youtube');assert.equal(requests.length,1);assert.equal(requests[0].options.credentials,'omit');
});
test('archive fallback validates video URL before fetching snapshot',async()=>{
 const urls=[];
 const result=await recoverDetails(id,{fetcher:async url=>{
  urls.push(url);
  if(url.includes('/oembed'))return {ok:false,status:404};
  if(url.includes('/cdx/'))return {ok:true,json:async()=>[['timestamp','original'],['20260924195412',`https://www.youtube.com/watch?v=${id}`],['20260925195412','https://attacker.example/page']]};
  return {ok:true,text:async()=>html()};
 }});
 assert.equal(result.title,'Recovered title');assert.equal(result.source,'archive');assert.equal(urls.length,3);
 assert.ok(urls[2].startsWith('https://web.archive.org/web/20260924195412id_/https://www.youtube.com/watch?'));
});
test('missing archive, rate limit and cancellation are explicit',async()=>{
 const missing=await recoverDetails(id,{fetcher:async url=>url.includes('/oembed')?{ok:false,status:404}:{ok:true,json:async()=>[]}});
 assert.equal(missing,null);
 await assert.rejects(()=>recoverDetails(id,{fetcher:async()=>({status:429,ok:false})}),/Rate limited/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(()=>recoverDetails(id,{signal:controller.signal,fetcher:async()=>{throw new Error('should not fetch');}}),/abort/i);
 await assert.rejects(()=>recoverDetails('invalid'),/usable video ID/);
});


test('older removal history gains cached details without changing restoration state',async()=>{
 const {recoverHistoryDetails}=await import('../recovery.js');
 const entry={historyId:'h',removedAt:100,restoredAt:200,outcome:'Removed',video:{videoId:id,title:'Deleted video',setVideoId:'s'}};
 const metadata={title:'Recovered title',channel:'Recovered channel',source:'archive',sourceUrl:'https://web.archive.org/'};
 const result=recoverHistoryDetails([entry],{[id]:metadata})[0];
 assert.equal(result.video.title,'Recovered title');assert.equal(result.video.channel,'Recovered channel');
 assert.equal(result.restoredAt,200);assert.equal(result.removedAt,100);assert.equal(result.video.setVideoId,'s');
 assert.equal(entry.video.title,'Deleted video');
});
