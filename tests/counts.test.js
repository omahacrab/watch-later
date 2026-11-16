import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPlaylistTotal,capacity} from '../counts.js';
test('sidebar count is independent of loaded rows and view counts',()=>{
 const data={sidebar:{playlistSidebarPrimaryInfoRenderer:{stats:[{runs:[{text:'4,809'},{text:' videos'}]},{simpleText:'100,000 views'}]}},contents:{playlistVideoListRenderer:{contents:[]}}};
 assert.equal(extractPlaylistTotal(data),4809);
 assert.deepEqual(capacity(4809),{total:4809,free:191,percent:96.17999999999999});
});
test('modern header metadata and legacy explicit counts',()=>{
 assert.equal(extractPlaylistTotal({header:{pageHeaderRenderer:{content:{pageHeaderViewModel:{metadata:{contentMetadataViewModel:{metadataRows:[{metadataParts:[{text:{content:'4,809 videos'}},{text:{content:'No views'}}]}]}}}}}}}),4809);
 assert.equal(extractPlaylistTotal({playlistHeaderRenderer:{numVideosText:{simpleText:'0 videos'}}}),0);
 assert.equal(extractPlaylistTotal({playlistHeaderRenderer:{numVideosText:{simpleText:'4.809'}}}),4809);
});
test('does not use row titles, view counts or approximate 4.8K labels',()=>{
 assert.equal(extractPlaylistTotal({contents:{playlistVideoListRenderer:{contents:[{playlistVideoRenderer:{title:{simpleText:'4809 videos'}}}]}}}),null);
 assert.equal(extractPlaylistTotal({playlistHeaderRenderer:{numVideosText:{simpleText:'4.8K videos'}}}),null);
 assert.equal(extractPlaylistTotal({},'4809 views'),null);
 assert.equal(extractPlaylistTotal({},'Watch Later\nFripa Le Stine\n4,809 videos No views Updated today'),4809);
});
