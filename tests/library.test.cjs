const {test}=require('node:test');
const assert=require('node:assert/strict');
const Library=require('../public/library.js');
function factory(abort=false){
 return {open(){const request={};queueMicrotask(()=>{
  request.result={transaction(){
   const tx={objectStore(){return {put(){const req={};queueMicrotask(()=>{
     req.result='doc-id';req.onsuccess();queueMicrotask(()=>{if(abort){tx.error=Error('Quota exceeded');tx.onabort();}else tx.oncomplete();});
   });return req;}};}};return tx;
  },close(){}};request.onsuccess();
 });return request;}};
}
test('storage only reports saved after transaction commit',async()=>{
 assert.equal(await new Library(factory()).put({id:'doc-id'}),'doc-id');
});
test('storage rejects transaction abort even when the put request succeeded',async()=>{
 await assert.rejects(new Library(factory(true)).put({id:'doc-id'}),/Quota exceeded/);
});
test('unavailable IndexedDB is an explicit error, not successful persistence',async()=>{
 await assert.rejects(new Library(null).list(),/無法使用本機文件庫/);
});
