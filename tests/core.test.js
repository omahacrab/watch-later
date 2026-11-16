import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePlaylist, mergeEntries, filterEntries, batches, confirmRemoval} from '../core.js';
const row = (id, videoId = 'shared') => ({playlistVideoRenderer: {setVideoId: id, videoId, title: {runs:[{text:'John Mearsheimer'}]}, shortBylineText:{runs:[{text:'Channel'}]}}});
const more = token => ({continuationItemRenderer:{continuationEndpoint:{continuationCommand:{token}}}});
test('reads initial entries and ignores recommendation videos', () => {
  const data = {contents:{playlistVideoListRenderer:{contents:[row('a'),more('next')]}}, sidebar:row('recommendation')};
  const result = parsePlaylist(data, true);
  assert.equal(result.videos.length, 1); assert.equal(result.token, 'next');
});
test('reads continuation results and terminal page', () => {
  const result = parsePlaylist({onResponseReceivedActions:[{appendContinuationItemsAction:{continuationItems:[row('b')]}}]});
  assert.equal(result.videos[0].setVideoId, 'b'); assert.equal(result.token, null);
});
test('preserves distinct playlist entries even when video IDs match', () => {
  const videos = parsePlaylist({playlistVideoListRenderer:{contents:[row('a'),row('b')]}}).videos;
  assert.equal(mergeEntries(videos, [videos[0]]).length, 2);
});
test('keeps unavailable rows without inventing removal IDs', () => {
  const result = parsePlaylist({playlistVideoListRenderer:{contents:[{playlistVideoRenderer:{title:{simpleText:'Deleted video'},isPlayable:false}}]}});
  assert.equal(result.videos[0].unavailable, true); assert.equal(result.placeholders, 1);
  assert.throws(() => batches(result.videos));
});
test('rejects malformed, error and ambiguous pagination responses', () => {
  assert.throws(() => parsePlaylist({foo:'bar'}));
  assert.throws(() => parsePlaylist({alerts:[{alertRenderer:{type:'ERROR',text:{simpleText:'Denied'}}}]}), /Denied/);
  assert.throws(() => parsePlaylist({playlistVideoListRenderer:{contents:[more('a'),more('b')]}}));
});
test('search is case and accent insensitive and supports field choice', () => {
  const videos = [{title:'John Méarsheimer on China',channel:'Professor',unavailable:false}];
  assert.equal(filterEntries(videos,'MEARSHEIMER china').length,1);
  assert.equal(filterEntries(videos,'professor','channel').length,1);
  assert.equal(filterEntries(videos,'professor','title').length,0);
  assert.equal(filterEntries(videos,'','both',true).length,0);
});
test('500 per batch, final remainder, deduplication', () => {
  const items = Array.from({length:1114}, (_,i) => ({setVideoId:String(i)}));
  assert.deepEqual(batches([...items,items[0]]).map(b => b.length),[500,500,114]);
});
test('only explicit successful responses are accepted', () => {
  assert.doesNotThrow(() => confirmRemoval({status:'STATUS_SUCCEEDED'}));
  for (const data of [{}, {status:'STATUS_FAILED'}, {status:'STATUS_SUCCEEDED',error:{}}]) assert.throws(() => confirmRemoval(data));
});

test('reads list-level continuation metadata on initial and subsequent pages', () => {
  for (const key of ['playlistVideoListRenderer', 'playlistVideoListContinuation']) {
    const result = parsePlaylist({[key]:{contents:[row('a')],continuations:[{nextContinuationData:{continuation:'next-page'}}]}},true);
    assert.equal(result.token,'next-page');assert.equal(result.suspiciousEnd,false);
  }
});
test('reads nested continuation commands inside load-more buttons', () => {
  const result=parsePlaylist({playlistVideoListRenderer:{contents:[row('a'),{continuationItemRenderer:{button:{buttonRenderer:{command:{commandExecutorCommand:{commands:[{continuationCommand:{token:'button-next'}}]}}}}}}]}},true);
  assert.equal(result.token,'button-next');
});
test('does not declare a full first page complete without evidence', () => {
  const contents=Array.from({length:100},(_,i)=>row(String(i)));
  const result=parsePlaylist({playlistVideoListRenderer:{contents}},true);
  assert.equal(result.suspiciousEnd,true);
  const exact=parsePlaylist({playlistVideoListRenderer:{contents},playlistHeaderRenderer:{numVideosText:{simpleText:'100 videos'}}},true);
  assert.equal(exact.suspiciousEnd,false);
  const larger=parsePlaylist({playlistVideoListRenderer:{contents},playlistSidebarPrimaryInfoRenderer:{stats:[{runs:[{text:'4,891 videos'}]}]}},true);
  assert.equal(larger.suspiciousEnd,true);assert.equal(larger.expectedTotal,4891);
});
test('unknown next-page markers are flagged, and diagnostics omit token values', () => {
  const result=parsePlaylist({playlistVideoListRenderer:{contents:[row('a'),{continuationItemRenderer:{futureCommand:{token:'secret-value'}}}]},context:{secret:'never-export'}},true);
  assert.equal(result.suspiciousEnd,true);
  assert.ok(!JSON.stringify(result.diagnostic).includes('secret-value'));
  assert.ok(!JSON.stringify(result.diagnostic).includes('never-export'));
});
test('reload-continuation commands are supported', () => {
  const result=parsePlaylist({reloadContinuationItemsCommand:{targetId:'playlist',continuationItems:[row('a'),more('new-next')]}});
  assert.equal(result.token,'new-next');
});

test('quoted phrase fixes the race / disgrace example', () => {
  const videos=[{title:'Will 2021 F1 war put Mercedes and Red Bull on the back foot in 2022?',channel:'THE RACE'},{title:'“They’re Laughing At Us!!!” This Is A DISGRACE',channel:'Russell Brand'}];
  assert.equal(filterEntries(videos,'the race').length,2);
  assert.deepEqual(filterEntries(videos,'"the race"'),[videos[0]]);
  assert.deepEqual(filterEntries(videos,'“the race”'),[videos[0]]);
  assert.deepEqual(filterEntries(videos,'"race"'),[videos[0]]);
});
test('quoted phrases stay inside one field and punctuation is literal', () => {
  const videos=[{title:'The',channel:'Race'},{title:'A C++ guide',channel:'Dev'}];
  assert.equal(filterEntries(videos,'"the race"').length,0);
  assert.equal(filterEntries(videos,'"C++"').length,1);
});
test('field filters, excluded phrases, OR and implicit AND combine', () => {
  const videos=[{title:'Formula 1 update',channel:'The Race'},{title:'Formula 1 shorts',channel:'The Race'},{title:'MotoGP review',channel:'Other'}];
  assert.deepEqual(filterEntries(videos,'channel:"the race" -title:shorts'),[videos[0]]);
  assert.equal(filterEntries(videos,'formula OR motogp').length,3);
  assert.equal(filterEntries(videos,'formula AND -shorts').length,1);
  assert.deepEqual(filterEntries(videos,'-channel:"the race"'),[videos[2]]);
  assert.deepEqual(filterEntries(videos,'title:motogp','channel'),[videos[2]]);
});
test('malformed quotes and unfinished operators match nothing', () => {
  const videos=[{title:'The Race',channel:'The Race'}];
  for(const query of ['"the race','""','channel:','the OR','OR the','"the"race']) assert.equal(filterEntries(videos,query).length,0,query);
});
