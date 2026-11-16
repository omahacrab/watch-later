import test from 'node:test';
import assert from 'node:assert/strict';
import {parseChannelSearch,channelVideosCommand,parseUploads,discoverChannels,mergeChannelLibrary,categoryVideos,removeCategory,publicationEstimate,validLibrary} from '../feeds-core.js';
const A='UC'+'a'.repeat(22),B='UC'+'b'.repeat(22);
const channel=(id,name)=>({channelRenderer:{channelId:id,title:{simpleText:name}}});
test('channel search scopes results to primary content and keeps distinct IDs with the same name',()=>{
 const result=parseChannelSearch({contents:{twoColumnSearchResultsRenderer:{primaryContents:{contents:[channel(A,'Example'),channel(B,'Example'),{continuationItemRenderer:{continuationEndpoint:{continuationCommand:{token:'next'}}}}]},secondaryContents:channel('UC'+'c'.repeat(22),'Recommendation')}}});
 assert.equal(result.channels.length,2);assert.equal(result.token,'next');
});
test('channel uploads use the returned Videos endpoint, deduplicate videos and retain reported progress',()=>{
 const data={contents:{twoColumnBrowseResultsRenderer:{tabs:[{tabRenderer:{title:'Videos',endpoint:{browseEndpoint:{browseId:A,params:'server-command'},commandMetadata:{webCommandMetadata:{url:'/channel/'+A+'/videos'}}},selected:true,content:{contents:[{videoRenderer:{videoId:'abcdefghijk',title:{simpleText:'Video'},publishedTimeText:{simpleText:'2 days ago'},thumbnailOverlays:[{thumbnailOverlayResumePlaybackRenderer:{percentDurationWatched:48}}]}},{gridVideoRenderer:{videoId:'abcdefghijk',title:{simpleText:'Video'},publishedTimeText:{simpleText:'2 days ago'},thumbnailOverlays:[{thumbnailOverlayResumePlaybackRenderer:{percentDurationWatched:48}}]}}]}}}]}}};
 assert.deepEqual(channelVideosCommand(data,A),{channelId:A,params:'server-command'});const parsed=parseUploads(data,{id:A,name:'Channel'},1e12);assert.equal(parsed.videos.length,1);assert.equal(parsed.videos[0].watchedPercent,48);assert.equal(parsed.videos[0].publishedEstimate,1e12-2*86400000);
});
test('discovery, library merge and category unions retain assignments and deduplicate collaborations',()=>{
 const videos=[{videoId:'one',channel:'A and B',title:'One',channels:[{id:A,name:'A'},{id:B,name:'B'}]},{videoId:'two',channel:'B',title:'Two',channels:[{id:B,name:'B'}]}];
 const found=discoverChannels(videos);assert.equal(found[1].savedCount,2);
 const channels=mergeChannelLibrary([{id:A,name:'Old name',cats:['crime'],added:true}],[...found]);assert.equal(channels[0].name,'A');assert.deepEqual(channels[0].cats,['crime']);channels[1].cats=['sport'];channels[1].added=true;
 assert.equal(categoryVideos([...videos,...videos],channels,['crime','sport']).length,2);assert.equal(categoryVideos(videos,channels,['crime']).length,1);assert.equal(categoryVideos(videos,channels,[],{all:true}).length,2);
});
test('deleting a category preserves channels and all-channel feed semantics',()=>{
 const library={categories:[{id:'a',name:'A'},{id:'b',name:'B'}],channels:[{id:A,cats:['a','b'],added:true}],feeds:[{id:'all',all:true,cats:[]},{id:'specific',all:false,cats:['a']}]};const result=removeCategory(library,'a');assert.deepEqual(result.channels[0].cats,['b']);assert.equal(result.feeds[0].all,true);assert.equal(result.feeds[1].all,false);assert.deepEqual(result.feeds[1].cats,[]);assert.equal(library.categories.length,2);
});
test('approximate publication dates do not invent a date for unknown labels; import validates identities',()=>{
 assert.equal(publicationEstimate('Streamed recently'),null);assert.equal(publicationEstimate('4 hours ago',1e12),1e12-14400000);
 const library={categories:[],channels:[{id:A,name:'Channel',cats:[],added:true}],feeds:[]};assert.deepEqual(validLibrary(library),library);assert.throws(()=>validLibrary({...library,channels:[{...library.channels[0],id:'javascript:bad'}]}),/Invalid channel/);
});
