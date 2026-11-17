import test from 'node:test';
import assert from 'node:assert/strict';
import {addChannelTags,removeCategory,validLibrary} from '../feeds-core.js';
const fresh=()=>({categories:[],channels:[{id:'UC'+'a'.repeat(22),name:'Example',cats:[],added:false}],feeds:[]});
test('inline tags reuse normalized names and create one linked feed with persistent metadata',()=>{
 const l=fresh(),id=l.channels[0].id;addChannelTags(l,id,[' Cooking ','cooking','Ｆｏｏｄ']);addChannelTags(l,id,['food']);
 assert.equal(l.categories.length,2);assert.equal(l.feeds.length,2);assert.equal(l.channels[0].cats.length,2);assert.equal(l.channels[0].added,true);
 assert.deepEqual(validLibrary(l),l);const removed=removeCategory(l,l.categories[0].id);assert.equal(removed.feeds.length,1);assert.equal(removed.channels[0].cats.length,1);
});
test('tagging reuses an existing single-category feed and rejects invalid tags atomically',()=>{
 const l=fresh(),id=l.channels[0].id;l.categories.push({id:'sport',name:'Sports'});l.feeds.push({id:'custom',name:'My sports',cats:['sport'],all:false,source:'saved',playlists:['WL']});
 addChannelTags(l,id,['sports']);assert.equal(l.feeds.length,1);assert.equal(l.feeds[0].name,'My sports');
 const before=structuredClone(l);assert.throws(()=>addChannelTags(l,id,['valid','x'.repeat(101)]),/100/);assert.deepEqual(l,before);
});
