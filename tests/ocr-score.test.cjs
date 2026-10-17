const {test}=require('node:test');
const assert=require('node:assert/strict');
test('CER counts substitution, insertion and deletion without clamping',async()=>{
 const {score}=await import('../sim/score-ocr.mjs');
 assert.equal(score('abc','axc').edits,1);assert.equal(score('abc','ab').edits,1);assert.equal(score('abc','abcd').edits,1);
 assert.equal(score('a','aaaa').cer,3);assert.equal(score('abc','').cer,1);
});
test('Unicode code points and NFC are used; compact mode only removes whitespace',async()=>{
 const {score}=await import('../sim/score-ocr.mjs');
 assert.equal(score('é','e\u0301').cer,0);assert.equal(score('字😀','字').cer,.5);
 assert.equal(score('a b','ab',true).cer,0);assert.ok(score('a b','ab').cer>0);
 assert.ok(score('Ａ','A',true).cer>0);assert.ok(score('中。','中',true).cer>0);
 assert.throws(()=>score(' ','x'),/Empty reference/);
});
test('evaluation requires exact unique identity sets and does not accept missing text',async()=>{
 const {evaluate}=await import('../sim/score-ocr.mjs');const m=[{id:'a',language:'eng',condition:'clean',reference_text:'abc'}];
 assert.throws(()=>evaluate(m,[]),/ID mismatch/);assert.throws(()=>evaluate(m,[{id:'b',text:'abc'}]),/ID mismatch/);
 assert.throws(()=>evaluate(m,[{id:'a',text:''},{id:'a',text:''}]),/Duplicate/);
 assert.throws(()=>evaluate(m,[{id:'a'}]),/string/);
 assert.equal(evaluate(m,[{id:'a',text:''}]).strict.cer,1);
});
test('micro-average weights by reference characters rather than page count',async()=>{
 const {evaluate}=await import('../sim/score-ocr.mjs');
 const m=[{id:'a',language:'eng',condition:'clean',reference_text:'a'},{id:'b',language:'eng',condition:'clean',reference_text:'bcdefghij'}];
 assert.equal(evaluate(m,[{id:'a',text:''},{id:'b',text:'bcdefghij'}]).compact.cer,.1);
});
