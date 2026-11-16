import test from 'node:test';
import assert from 'node:assert/strict';
import {firstResultScrollTarget as target} from '../scroll-position.js';
const base={header:{height:240,bottom:240},viewportHeight:900,scrollY:1000};
test('channel filtering reveals a result hidden by the sticky header',()=>{
 assert.equal(target({...base,row:{top:100,bottom:220}}),852);
 assert.equal(target({...base,header:{height:350,bottom:350},row:{top:100,bottom:220}}),742);
});
test('visible result does not cause a scroll jump',()=>{
 assert.equal(target({...base,row:{top:248,bottom:400}}),null);
});
test('offscreen result scrolls beneath header and never above document start',()=>{
 assert.equal(target({...base,row:{top:950,bottom:1100}}),1702);
 assert.equal(target({...base,scrollY:0,row:{top:100,bottom:220}}),0);
});
test('oversized result already aligned below header does not keep scrolling',()=>{
 assert.equal(target({...base,row:{top:248,bottom:1400}}),null);
});
