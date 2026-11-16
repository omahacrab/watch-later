import test from 'node:test';
import assert from 'node:assert/strict';
import {selectRange} from '../selection.js';
const rows=Array.from({length:510},(_,i)=>({key:String(i),setVideoId:String(i)}));
test('Shift-click selects inclusive ranges in either direction across result pages',()=>{
 const selected=new Set();selectRange(selected,rows,'0','6',true,true);assert.equal(selected.size,7);
 selected.clear();selectRange(selected,rows,'504','498',true,false);assert.equal(selected.size,7);assert.ok(selected.has('498'));assert.ok(selected.has('504'));
});
test('range skips unremovable rows and stale anchor falls back to ordinary click',()=>{
 const selected=new Set();selectRange(selected,[rows[0],{key:'no-id'},rows[2]],'0','2',true,true);assert.equal(selected.size,2);
 selectRange(selected,rows,'missing','5',true,true);assert.ok(selected.has('5'));
 selectRange(selected,rows,'5','5',false,false);assert.ok(!selected.has('5'));
});
