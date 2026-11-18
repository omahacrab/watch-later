import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWatchHistory} from '../watch-history.js';
import {selectRange} from '../selection.js';
import {validLibrary} from '../feeds-core.js';
const A='UC'+'a'.repeat(22);
const row=id=>({videoRenderer:{videoId:id,title:{simpleText:'Previously watched'},shortBylineText:{runs:[{text:'A channel',navigationEndpoint:{browseEndpoint:{browseId:A}}}]},lengthText:{simpleText:'2:12'}}});
const next=token=>({continuationItemRenderer:{continuationEndpoint:{continuationCommand:{token}}}});
test('History scopes videos and pagination to primary content and never creates removal IDs',()=>{
 const parsed=parseWatchHistory({contents:{twoColumnBrowseResultsRenderer:{tabs:[{tabRenderer:{selected:true,content:{sectionListRenderer:{contents:[{itemSectionRenderer:{contents:[row('aaaaaaaaaaa'),row('aaaaaaaaaaa')]}},next('history-next')]}}}}],secondaryContents:{itemSectionRenderer:{contents:[row('bbbbbbbbbbb'),next('sidebar-next')]}}}}});
 assert.equal(parsed.videos.length,1);assert.equal(parsed.videos[0].setVideoId,'');assert.equal(parsed.videos[0].source,'youtube-history');assert.equal(parsed.videos[0].watchedPercent,null);assert.deepEqual(parsed.videos[0].channels,[{id:A,name:'A channel'}]);assert.equal(parsed.token,'history-next');
 const selected=new Set();selectRange(selected,[...parsed.videos,{...parsed.videos[0],key:'second'}],parsed.videos[0].key,'second',true,true);assert.equal(selected.size,2);
});
test('History parses modern video cards and paginated results',()=>{
 const parsed=parseWatchHistory({onResponseReceivedActions:[{appendContinuationItemsAction:{continuationItems:[{lockupViewModel:{contentType:'LOCKUP_CONTENT_TYPE_VIDEO',contentId:'bbbbbbbbbbb',metadata:{lockupMetadataViewModel:{title:{content:'A modern video'},metadata:{metadataRows:[{metadataParts:[{text:{content:'Channel B',commandRuns:[{onTap:{innertubeCommand:{browseEndpoint:{browseId:A}}}}]}}]}]}}}}},next('more')]}}]});
 assert.equal(parsed.videos[0].title,'A modern video');assert.equal(parsed.videos[0].channel,'Channel B');assert.equal(parsed.token,'more');
});
test('History handles empty history while rejecting failures and unknown formats',()=>{
 assert.deepEqual(parseWatchHistory({sectionListRenderer:{contents:[]}}).videos,[]);
 assert.throws(()=>parseWatchHistory({unexpected:true}),/unfamiliar History/);
 assert.throws(()=>parseWatchHistory({alerts:[{alertRenderer:{type:'ERROR',text:{simpleText:'Unavailable'}}}]}),/Unavailable/);
 assert.throws(()=>parseWatchHistory({sectionListRenderer:{contents:[next('one'),next('two')]}}),/multiple History/);
 assert.equal(parseWatchHistory({sectionListRenderer:{contents:[{continuationItemRenderer:{}}]}}).suspiciousEnd,true);
});
test('saved feed backup preserves explicit History sources',()=>{
 const data={channels:[],categories:[],feeds:[{id:'f',name:'Watched',all:true,cats:[],source:'saved',playlists:['FEhistory','WL']}]};
 assert.deepEqual(validLibrary(data).feeds[0].playlists,['FEhistory','WL']);
});
