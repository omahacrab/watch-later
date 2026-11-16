import test from 'node:test';
import assert from 'node:assert/strict';
import {splitPills,watchProgress,watchMatches} from '../search-pills.js';
import {editablePlaylists,copyThenRemove} from '../playlists.js';
test('commas commit OR pills except inside quoted phrases',()=>{
 assert.deepEqual(splitPills('mearsheimer,"the race", motogp'),{complete:['mearsheimer','"the race"'],tail:' motogp'});
 assert.deepEqual(splitPills('title:"one, two",three,'),{complete:['title:"one, two"','three'],tail:''});
 assert.deepEqual(splitPills('“one, two”,'),{complete:['“one, two”'],tail:''});
});
test('playback percentages are explicit, missing never means unwatched',()=>{
 assert.equal(watchProgress({thumbnailOverlays:[{thumbnailOverlayResumePlaybackRenderer:{percentDurationWatched:42}}]}),42);
 assert.equal(watchProgress({}),null);
 assert.equal(watchMatches({watchedPercent:42},'partial'),true);
 assert.equal(watchMatches({watchedPercent:100},'complete'),true);
 assert.equal(watchMatches({},'complete'),false);assert.equal(watchMatches({},'partial'),false);
 assert.equal(watchMatches({},'unknown'),true);
});
test('playlist picker accepts offered targets, excludes Watch Later and disabled entries',()=>{
 const option=(id,title,isDisabled=false)=>({playlistAddToOptionRenderer:{playlistId:id,title:{simpleText:title},isDisabled}});
 assert.deepEqual(editablePlaylists({items:[option('PL1','Keep'),option('WL','Watch Later'),option('PL2','Disabled',true)]}),[{id:'PL1',title:'Keep',videoCount:null}]);
});
test('move removes only after addition and destination verification',async()=>{
 const log=[];await copyThenRemove({ids:['v'],add:async()=>log.push('add'),verify:async()=>log.push('verify'),remove:async()=>log.push('remove')});
 assert.deepEqual(log,['add','verify','remove']);
});
test('failed or unverified copy never removes source',async()=>{
 for(const failure of ['add','verify']){
  let deleted=false;
  await assert.rejects(copyThenRemove({ids:['v'],add:async()=>{if(failure==='add')throw Error('fail')},verify:async()=>{if(failure==='verify')throw Error('fail')},remove:async()=>{deleted=true}}));
  assert.equal(deleted,false);
 }
});


test('explicit empty destination messages are accepted only in selected playlist content',async()=>{
 const {emptyDestination,playlistStructure}=await import('../playlists.js');
 const empty={messageRenderer:{text:{simpleText:'This playlist has no videos.'}}};
 const page=content=>({contents:{twoColumnBrowseResultsRenderer:{tabs:[{tabRenderer:{selected:true,content}}]}}});
 assert.equal(emptyDestination(page({sectionListRenderer:{contents:[empty]}})),true);
 assert.equal(emptyDestination({sidebar:empty}),false);
 assert.equal(emptyDestination(page({messageRenderer:{text:{simpleText:'Playlist unavailable'}}})),false);
 assert.equal(emptyDestination({...page(empty),alerts:[{alertRenderer:{type:'ERROR'}}]}),false);
 assert.equal(emptyDestination(page({contents:[empty,{continuationItemRenderer:{}}]})),false);
 assert.equal(emptyDestination(page({contents:[empty,{playlistVideoRenderer:{videoId:'v'}}]})),false);
 assert.equal(emptyDestination({}),false);
 const diagnostic=playlistStructure({...page(empty),context:{secret:'private'},continuationCommand:{token:'private-token'}});
 assert.ok(!JSON.stringify(diagnostic).includes('private'));
 assert.ok(diagnostic.some(p=>p.endsWith('/messageRenderer')));
});

test('playlist row counts read exact metadata including zero, never title digits',()=>{
 const option=(id,fields)=>({playlistAddToOptionRenderer:{playlistId:id,title:{simpleText:'Top 100 videos'},...fields}});
 assert.deepEqual(editablePlaylists({items:[option('PL1',{videoCountText:{simpleText:'1,234 videos'}}),option('PL2',{videoCount:0}),option('PL3',{}),option('PL4',{videoCountText:{simpleText:'1.2K videos'}})]}).map(p=>p.videoCount),[1234,0,null,null]);
});


test('destination verification tolerates stale reads and reports persistent missing IDs',async()=>{
 const {verifyDestinationVideos}=await import('../playlists.js');let reads=0;const waits=[];
 const result=await verifyDestinationVideos({ids:['a','b'],read:async()=>new Set(++reads<3?['a']:['a','b']),wait:async ms=>waits.push(ms)});
 assert.deepEqual(result.missing,[]);assert.equal(reads,3);assert.deepEqual(waits,[400,1000]);
 reads=0;const missing=await verifyDestinationVideos({ids:['a','b'],read:async()=>{reads++;return new Set(['a']);},wait:async()=>{}});
 assert.deepEqual(missing.missing,['b']);assert.equal(reads,4);
 await assert.rejects(()=>verifyDestinationVideos({ids:['a'],read:async()=>{throw new Error('must not read');},stopped:()=>true}),/Stopped/);
});
