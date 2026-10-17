const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function workflow(){
 class Element{
  constructor(){this.children=[];this.value='';this.disabled=false;this.checked=false;this.style={};}
  append(...x){this.children.push(...x);}replaceChildren(){this.children=[];}setAttribute(){}
  getContext(){return {fillRect(){},translate(){},rotate(){},drawImage(){}};}toDataURL(){return 'data:image/jpeg;base64,';}
 }
 const ids=['status','pages','pdf','ocr','clear','camera','upload','language','mode','text','name','phone','email','company','copy','translate','vcard','save-document','document-name','document-category','searchable-pdf','suggest-name','library-query','library-category','crop-auto','crop-reset','crop-close','crop-apply','crop-left','crop-top','crop-right','crop-bottom','crop-preview'];
 const elements=Object.fromEntries(ids.map(id=>[id,new Element()])),records=new Map();
 const sandbox={TextEncoder,Blob,setTimeout,crypto:{randomUUID:()=> 'test-document'},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
  document:{getElementById:id=>elements[id],createElement:()=>new Element(),querySelectorAll:s=>s==='button,input,select,textarea'?Object.values(elements):[]},
  Image:class{constructor(){this.naturalWidth=800;this.naturalHeight=400;}set src(x){queueMicrotask(()=>this.onload());}},
  window:{SmartScanTools:require('../public/document-tools.js'),SmartScanLibrary:class{
   async get(id){return records.get(id);}async list(){return [...records.values()];}async put(record){records.set(record.id,record);}
  }}
 };
 const ctx=vm.createContext(sandbox);
 for(const file of ['runtime-config','app','document-workflow'])vm.runInContext(fs.readFileSync(`public/${file}.js`,'utf8'),ctx);
 const run=code=>vm.runInContext(code,ctx);
 const setup=()=>run('pages=[{file:{name:"first.png",size:1},url:"first",rotation:0,crop:null,text:"first",words:[{text:"old"}]},{file:{name:"second.png",size:1},url:"second",rotation:0,crop:null,text:"second",words:[]}];refreshEditor();render();');
 return {elements,records,run,setup};
}
test('reordering keeps edited per-page text attached to the correct image',()=>{
 const a=workflow();a.setup();a.elements.text.value='first edited\n\n--- 下一頁 ---\n\nsecond edited';
 a.elements.pages.children[1].children[2].onclick();
 assert.equal(a.run('pages[0].url'),'second');assert.equal(a.run('pages[0].text'),'second edited');
 assert.equal(a.elements.text.value,'second edited\n\n--- 下一頁 ---\n\nfirst edited');
});
test('rotation invalidates only the affected page text and disables the searchable option',()=>{
 const a=workflow();a.setup();a.elements['searchable-pdf'].checked=true;
 a.elements.pages.children[0].children[4].onclick();
 assert.equal(a.run('pages[0].text'),'');assert.equal(a.run('pages[1].text'),'second');
 assert.equal(a.elements['searchable-pdf'].checked,false);assert.equal(a.run('pages[0].words.length'),0);
});
test('broken page separators prevent mutation instead of moving text onto the wrong page',()=>{
 const a=workflow();a.setup();a.elements.text.value='separator removed';
 a.elements.pages.children[1].children[2].onclick();assert.equal(a.run('pages[0].url'),'first');
 assert.match(a.elements.status.textContent,/分隔/);
});
test('saved snapshots keep original blobs/crop/text without transient object URLs',async()=>{
 const a=workflow();a.setup();a.elements['document-name'].value='custom name';a.elements['document-category'].value='other';
 await a.elements['save-document'].onclick();const record=a.records.get('test-document');
 assert.equal(record.name,'custom name');assert.equal(record.category,'other');assert.equal(record.pages[0].file.name,'first.png');
 assert.equal('url' in record.pages[0],false);assert.equal(record.pages[1].text,'second');assert.equal(a.run('sessionDirty'),false);
});
test('failed save never marks unsaved content as saved',async()=>{
 const a=workflow();a.setup();a.run('markDirty();documentLibrary.put=async()=>{throw Error("quota")};');
 await a.elements['save-document'].onclick();assert.match(a.elements.status.textContent,/儲存失敗/);
 assert.equal(a.run('sessionDirty'),true);assert.equal(a.run('currentDocumentId'),null);
});
test('manual category and filename survive automatic metadata suggestions',()=>{
 const a=workflow();a.setup();a.elements['document-name'].value='manual';a.elements['document-category'].value='other';
 a.elements['document-category'].onchange();a.run('suggestDocument(false)');
 assert.equal(a.elements['document-name'].value,'manual');assert.equal(a.elements['document-category'].value,'other');
});
test('searchable export refuses pages without text instead of claiming success',async()=>{
 const a=workflow();a.setup();a.run('pages[1].text="";refreshEditor()');a.elements['searchable-pdf'].checked=true;
 a.run('window.jspdf={}');await a.elements.pdf.onclick();assert.match(a.elements.status.textContent,/補齊每頁文字/);
 assert.equal(a.elements.pdf.disabled,false);
});
