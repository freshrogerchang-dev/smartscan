const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function app(){
 class Element{
  constructor(){this.value='';this.children=[];this.disabled=false;this.hidden=false;this.checked=false;this.style={};this.classList={toggle(){}};this.open=false;}
  append(...items){this.children.push(...items);}replaceChildren(){this.children=[];}setAttribute(){}addEventListener(){}showModal(){this.open=true;}close(){this.open=false;}
 }
 const elements=Object.fromEntries([...fs.readFileSync('public/index.html','utf8').matchAll(/\bid="([^"]+)"/g)].map(match=>[match[1],new Element()]));
 const records=new Map();let serial=0;
 const context=vm.createContext({console,Blob,TextEncoder,Uint8Array,DataView,AbortController,setTimeout,clearTimeout,crypto:{randomUUID:()=>`contact-${++serial}`},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
  document:{getElementById:id=>elements[id],querySelectorAll:selector=>selector==='button,input,select,textarea'?Object.values(elements):[],createElement:()=>new Element()},
  window:{SmartScanTools:require('../public/document-tools.js'),SmartScanProductivity:require('../public/productivity-tools.js'),SmartScanAdvanced:require('../public/advanced-tools.js'),SmartScanLibrary:class{async list(){return [...records.values()];}async get(id){return records.get(id);}async put(record){records.set(record.id,record);}}}
 });
 for(const name of ['runtime-config','app','document-workflow','productivity','advanced'])vm.runInContext(fs.readFileSync('public/'+name+'.js','utf8'),context);
 const run=code=>vm.runInContext(code,context);return {elements,records,run};
}
test('local translation keeps original snapshot, saves the comparison and destroys the model',async()=>{
 const a=app();a.elements.text.value='Hello';a.elements['translation-source-language'].value='en';a.elements['translation-target-language'].value='zh-Hant';
 a.run('window.Translator={create:async()=>({translate:async text=>"你好",destroy(){window.destroyed=true;}})}');
 await a.elements['translate-local'].onclick();assert.equal(a.elements['translation-original'].value,'Hello');assert.equal(a.elements['translation-result'].value,'你好');assert.equal(a.run('window.destroyed'),true);assert.equal(a.run('busy'),false);
 assert.equal(a.run('productivitySnapshot().translation.text'),'你好');
});
test('translation preserves page separators instead of translating structural markers',async()=>{
 const a=app();a.elements.text.value='First\n\n--- 下一頁 ---\n\nSecond';a.elements['translation-source-language'].value='en';a.elements['translation-target-language'].value='ja';
 a.run('window.calls=[];window.Translator={create:async()=>({translate:async text=>{window.calls.push(text);return "translated:"+text;},destroy(){}})}');
 await a.elements['translate-local'].onclick();assert.deepEqual(Array.from(a.run('window.calls')),['First','Second']);assert.equal(a.elements['translation-result'].value,'translated:First\n\n--- 下一頁 ---\n\ntranslated:Second');
});
test('translation failure and cancellation preserve prior comparison and unlock controls',async()=>{
 const a=app();a.elements.text.value='New';a.elements['translation-original'].value='Old';a.elements['translation-result'].value='舊';a.elements['translation-source-language'].value='en';a.elements['translation-target-language'].value='ja';
 a.run('window.Translator={create:async()=>{throw Error("model unavailable")}}');await a.elements['translate-local'].onclick();
 assert.equal(a.elements['translation-original'].value,'Old');assert.equal(a.elements['translation-result'].value,'舊');assert.match(a.elements['translation-message'].textContent,/未完成/);assert.equal(a.run('busy'),false);
 a.run('window.Translator={create:options=>new Promise((resolve,reject)=>options.signal.addEventListener("abort",()=>reject(Error("cancelled"))))}');
 const pending=a.elements['translate-local'].onclick();assert.equal(a.elements['translation-cancel'].disabled,false);a.elements['translation-cancel'].onclick();await pending;assert.equal(a.run('busy'),false);assert.equal(a.elements['translation-result'].value,'舊');
});
test('contact write failure does not claim a saved identity',async()=>{
 const a=app();a.elements.name.value='Test';a.run('documentLibrary.put=async()=>{throw Error("quota")};');await a.elements['contact-save'].onclick();
 assert.equal(a.run('contactTarget'),null);assert.equal(a.records.size,0);assert.match(a.elements.status.textContent,/儲存失敗/);assert.equal(a.run('busy'),false);
});
test('merge rejects stale candidates instead of overwriting changed contacts',async()=>{
 const a=app(),record={id:'saved',kind:'contact',name:'Old',contact:{name:'Old',email:'a@example.com'},updatedAt:1};a.records.set('saved',record);
 a.elements.name.value='New';a.run('openContactMerge({id:"saved",kind:"contact",contact:{name:"Old",email:"a@example.com"},updatedAt:0})');
 await a.elements['contact-merge-apply'].onclick();assert.equal(a.records.get('saved').name,'Old');assert.match(a.elements.status.textContent,/已變更/);assert.equal(a.run('busy'),false);
});
test('batch cancellation finishes the active page and reports omitted pages explicitly',async()=>{
 const a=app();a.run('pages=[1,2,3].map(i=>({file:{size:100},rotation:0,text:"",url:String(i)}));pageCanvas=async()=>({width:100,height:100,toBlob(callback){$("batch-cancel").onclick();callback(new Blob(["jpeg"]));}})');
 await a.elements['batch-start'].onclick();assert.match(a.elements['batch-message'].textContent,/完成 1\/3/);assert.equal(a.elements['batch-download'].hidden,false);assert.equal(a.elements['batch-jobs'].children[1].textContent,'第 2 頁 · 已取消');assert.equal(a.run('busy'),false);
});
test('batch continues after a failed page and packages only completed output',async()=>{
 const a=app();a.run('pages=[1,2].map(i=>({file:{size:100},rotation:0,text:"",url:String(i)}));pageCanvas=async page=>{if(page.url==="1")throw Error("decode");return {width:100,height:100,toBlob(callback){callback(new Blob(["jpeg"]));}}}');
 await a.elements['batch-start'].onclick();assert.match(a.elements['batch-message'].textContent,/完成 1\/2/);assert.match(a.elements['batch-jobs'].children[0].textContent,/失敗/);assert.equal(a.elements['batch-download'].hidden,false);
});
test('unavailable local model keeps previous answer and source and always unlocks',async()=>{
 const a=app();a.elements.text.value='Budget 200';a.elements['ai-page'].value='0';a.elements['ai-language'].value='en';a.elements['ai-result'].value='old answer';a.elements['ai-source'].value='old source';
 a.run('window.LanguageModel={availability:async()=>"unavailable",create:async()=>{throw Error("must not run")}}');await a.elements['ai-summary'].onclick();
 assert.equal(a.elements['ai-result'].value,'old answer');assert.equal(a.elements['ai-source'].value,'old source');assert.match(a.elements['ai-message'].textContent,/沒有可用的文字模型/);assert.equal(a.run('busy'),false);
});
test('local QA retains original page source and destroys session after a mocked provider result',async()=>{
 const a=app();a.elements.text.value='Budget 200\n\n--- 下一頁 ---\n\nAlice prepares slides';a.elements['ai-page'].value='2';a.elements['ai-language'].value='en';a.elements['ai-question'].value='Who prepares slides?';
 a.run('window.LanguageModel={availability:async()=>"available",create:async()=>({prompt:async input=>{window.input=input;return "Alice [P2]";},destroy(){window.cleaned=true;}})}');await a.elements['ai-ask'].onclick();
 assert.equal(a.elements['ai-result'].value,'Alice [P2]');assert.match(a.elements['ai-source'].value,/^\[P2\]/);assert.equal(a.run('window.cleaned'),true);assert.doesNotMatch(a.elements['ai-source'].value,/Budget/);
});
test('model cancellation keeps old vision output and releases the interface',async()=>{
 const a=app();a.elements['vision-result'].value='old';a.run('window.LanguageModel={availability:async()=>"available",create:options=>new Promise((resolve,reject)=>options.signal.addEventListener("abort",()=>reject(Error("cancelled"))))}');
 const pending=a.run('runLocalModel({image:true,statusId:"vision-message",prompt:async()=>[],finish:result=>$("vision-result").value=result})');await new Promise(resolve=>setImmediate(resolve));a.elements['advanced-cancel'].onclick();await pending;assert.equal(a.elements['vision-result'].value,'old');assert.equal(a.run('busy'),false);
});
test('table, event and AI drafts survive saved-document snapshot and restore',()=>{
 const a=app();a.elements['event-title'].value='Meeting';a.elements['event-zone'].value='Asia/Taipei';a.elements['event-start'].value='2026-10-20T14:00';a.elements['ai-result'].value='draft';a.run('tableRows=[["A","1"]];window.snapshot={advanced:advancedSnapshot()};resetAdvanced();restoreAdvanced(window.snapshot)');
 assert.equal(a.elements['event-title'].value,'Meeting');assert.equal(a.elements['ai-result'].value,'draft');assert.equal(a.run('tableRows[0][1]'),'1');
});
