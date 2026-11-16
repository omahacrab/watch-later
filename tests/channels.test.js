import test from 'node:test';
import assert from 'node:assert/strict';
import {channelIndex,channelsFor,sharesChannel} from '../channels.js';
import {parsePlaylist} from '../core.js';
const a={id:'UC_A',name:'BeanymanSports'}, b={id:'UC_B',name:'EnglandFanZone'}, c={id:'UC_C',name:'Third Channel'};
const video=(channels)=>({channel:channels.map(c=>c.name).join(' and '),channels});
test('single-channel button includes collaborations and renamed display labels',()=>{
 const videos=[video([a]),video([a,b]),video([{id:'UC_A',name:'Different display name'}]),video([b])];
 const index=channelIndex(videos);
 assert.deepEqual(videos.filter(v=>sharesChannel(v,channelsFor(videos[0],index),index)),videos.slice(0,3));
});
test('two and three collaborators match the union of participating channels',()=>{
 const videos=[video([a]),video([b]),video([c]),video([a,b]),video([a,b,c]),video([{id:'UC_D',name:'Other'}])];
 const index=channelIndex(videos);
 assert.equal(videos.filter(v=>sharesChannel(v,channelsFor(videos[3],index),index)).length,4);
 assert.equal(videos.filter(v=>sharesChannel(v,channelsFor(videos[4],index),index)).length,5);
});
test('same display name does not conflate different known channel IDs',()=>{
 const videos=[video([a]),video([{id:'UC_OTHER',name:a.name}])];
 const index=channelIndex(videos);
 assert.equal(sharesChannel(videos[1],[a],index),false);
});
test('older caches resolve combined names from independently known channels',()=>{
 const videos=[{channel:'BeanymanSports'},{channel:'EnglandFanZone'},{channel:'BeanymanSports and EnglandFanZone'}];
 const index=channelIndex(videos);
 assert.equal(channelsFor(videos[2],index).length,2);
 assert.equal(videos.filter(v=>sharesChannel(v,channelsFor(videos[2],index),index)).length,3);
 assert.equal(videos.filter(v=>sharesChannel(v,channelsFor(videos[0],index),index)).length,2);
});
test('does not blindly split a single channel containing and',()=>{
 const video={channel:'Of Mice and Men'};
 assert.equal(channelsFor(video,channelIndex([video])).length,1);
});
test('playlist parser retains independent channel links while ignoring separators',()=>{
 const runs=[{text:a.name,navigationEndpoint:{browseEndpoint:{browseId:a.id}}},{text:' and '},{text:b.name,navigationEndpoint:{browseEndpoint:{browseId:b.id}}}];
 const data={playlistVideoListRenderer:{contents:[{playlistVideoRenderer:{videoId:'v',setVideoId:'s',title:{simpleText:'Title'},shortBylineText:{runs}}}]}};
 assert.deepEqual(parsePlaylist(data,true).videos[0].channels,[a,b]);
});
