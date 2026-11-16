import test from 'node:test';import assert from 'node:assert/strict';
import {playlistOptions,unavailableVideo,sortVideos} from '../list-options.js';
test('extracts actual show-unavailable and native sort requests',()=>{
 const data={menuNavigationItemRenderer:{text:{simpleText:'Show unavailable videos'},navigationEndpoint:{browseEndpoint:{browseId:'VLWL',params:'expanded'}}},sortFilterSubMenuRenderer:{subMenuItems:[{title:'Date published (oldest)',serviceEndpoint:{browseEndpoint:{browseId:'VLWL',params:'oldest'}}},{title:'Most popular',serviceEndpoint:{continuationCommand:{token:'sort-token'}}}]}};
 assert.deepEqual(playlistOptions(data),{activeSort:null,unavailable:{params:'expanded'},alreadyShown:false,sorts:[{title:'Date published (oldest)',command:{params:'oldest'}},{title:'Most popular',command:{token:'sort-token'}}]});
});
test('rejects other playlist browse commands and detects expanded page',()=>{
 const data={menuNavigationItemRenderer:{text:{simpleText:'Show unavailable videos'},navigationEndpoint:{browseEndpoint:{browseId:'VL_OTHER',params:'bad'}}}};
 assert.equal(playlistOptions(data).unavailable,null);
 assert.equal(playlistOptions({menuServiceItemRenderer:{text:{simpleText:'Hide unavailable videos'}}}).alreadyShown,true);
});
test('recognizes placeholders without classifying ordinary titles as unavailable',()=>{
 assert.equal(unavailableVideo({videoId:'v',title:{simpleText:'[Private video]'}}),true);
 assert.equal(unavailableVideo({videoId:'v',title:{simpleText:'Deleted video'}}),true);
 assert.equal(unavailableVideo({videoId:'v',title:{simpleText:'How to make a private video'}}),false);
});
test('local sorting handles durations and preserves original array',()=>{
 const a={title:'Z',channel:'B',duration:'1:05:00'},b={title:'A',channel:'A',duration:'12:03'},c={title:'Live',channel:'C',duration:''};
 const videos=[a,b,c];assert.deepEqual(sortVideos(videos,'shortest'),[b,a,c]);assert.deepEqual(sortVideos(videos,'longest'),[a,b,c]);
 assert.deepEqual(sortVideos(videos,'title'),[b,c,a]);assert.deepEqual(sortVideos(videos,'reverse'),[c,b,a]);assert.deepEqual(videos,[a,b,c]);
});

test('reads selected sort even without a command and does not guess',()=>{
 assert.equal(playlistOptions({sortFilterSubMenuRenderer:{subMenuItems:[{title:'Manual'},{title:'Date added (oldest)',selected:true}]}}).activeSort,'Date added (oldest)');
 assert.equal(playlistOptions({}).activeSort,null);
});
