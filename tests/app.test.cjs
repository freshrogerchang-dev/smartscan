const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function app() {
  class Element {
    constructor() { this.children=[]; this.value=''; this.disabled=false; this.style={}; }
    append(...items) { this.children.push(...items); }
    replaceChildren() { this.children=[]; }
    setAttribute() {}
    click() {}
    remove() {}
    getContext() { return { fillRect(){}, translate(){}, rotate(){}, drawImage(...args){drawCalls.push(args)} }; }
    toDataURL() { return 'data:image/jpeg;base64,'; }
  }
  const elements = Object.fromEntries(['status','pages','pdf','ocr','clear','camera','upload','language','mode','text','name','phone','email','company','copy','translate','vcard'].map(id=>[id,new Element()]));
  const revoked=[],pdfImages=[],drawCalls=[];
  const sandbox = { TextEncoder, document: { body:new Element(), getElementById:id=>elements[id], createElement:()=>new Element(), querySelectorAll:selector=>selector==='button,input,select,textarea'?Object.values(elements):[] }, URL: { createObjectURL: f=>f.name, revokeObjectURL:u=>revoked.push(u) }, alert(){}, navigator:{}, Blob, setTimeout, Image:class { constructor(){this.naturalWidth=800;this.naturalHeight=400} set src(v){queueMicrotask(()=>this.onload())} }, window: { jspdf: { jsPDF: class { addPage(){} addImage(...a){pdfImages.push(a)} save(){} } } } };
  const ctx=vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('public/runtime-config.js','utf8'),ctx);
  vm.runInContext(fs.readFileSync('public/app.js','utf8'),ctx);
  return { elements, revoked, pdfImages, drawCalls, sandbox, run:s=>vm.runInContext(s,ctx), add:n=>vm.runInContext(`add(${JSON.stringify(Array.from({length:n},(_,i)=>({name:`image${i}`,type:'image/png',size:100})))});`,ctx) };
}

test('empty document disables exports; reorder, rotate and delete preserve page identity',async()=>{
 const a=app(); assert.equal(a.elements.pdf.disabled,true);await a.add(2);
 a.elements.pages.children[1].children[2].onclick();
 assert.equal(a.run('pages[0].file.name'),'image1');
 a.elements.pages.children[0].children[4].onclick();
 assert.equal(a.run('pages[0].rotation'),90);
 a.elements.pages.children[0].children[5].onclick();
 assert.equal(a.run('pages.length'),1);assert.deepEqual(a.revoked,['image1']);
 a.elements.clear.onclick();assert.equal(a.elements.pdf.disabled,true);assert.deepEqual(a.revoked,['image1','image0']);
});
test('PDF locks edits while loading and exports rotated A4 image',async()=>{
 const a=app();await a.add(1);a.run('pages[0].rotation=90');
 const exporting=a.elements.pdf.onclick();assert.equal(a.elements.clear.disabled,true);
 a.elements.clear.onclick();assert.equal(a.run('pages.length'),1);await exporting;
 assert.equal(a.elements.clear.disabled,false);assert.equal(a.pdfImages.length,1);
 const [, , , , width,height]=a.pdfImages[0];assert.ok(height>width);assert.ok(height<=297);
});
test('missing PDF dependency reports failure and unlocks controls',async()=>{
 const a=app();await a.add(1);delete a.sandbox.window.jspdf;await a.elements.pdf.onclick();
 assert.match(a.elements.status.textContent,/PDF 失敗/);assert.equal(a.elements.pdf.disabled,false);
});
test('OCR failure including worker cleanup always unlocks controls',async()=>{
 const a=app();await a.add(1);
 a.sandbox.Tesseract=a.sandbox.window.Tesseract={createWorker:async()=>({recognize:async()=>{throw Error('recognition failed')},terminate:async()=>{throw Error('cleanup failed')}})};
 await a.elements.ocr.onclick();assert.equal(a.elements.clear.disabled,false);assert.equal(a.elements.ocr.disabled,false);assert.match(a.elements.status.textContent,/OCR 結束失敗/);
});
test('OCR processes rotated canvas, preserves order, and terminates its worker',async()=>{
 const a=app();await a.add(2);a.run('pages[0].rotation=90');let dimensions=[],terminated=false;
 a.sandbox.Tesseract=a.sandbox.window.Tesseract={createWorker:async()=>({recognize:async c=>{dimensions.push([c.width,c.height]);return {data:{text:String(dimensions.length)}}},terminate:async()=>{terminated=true}})};
 await a.elements.ocr.onclick();assert.deepEqual(dimensions,[[400,800],[800,400]]);assert.equal(terminated,true);assert.match(a.elements.text.value,/1\n\n--- 下一頁 ---\n\n2/);
});


test('imports reject invalid files with readable errors and revoke undecodable URLs',async()=>{
 const a=app();
 a.sandbox.Image=class{set src(v){queueMicrotask(()=>this.onerror())}};
 await a.run('add([{name:"bad.heic",type:"image/heic",size:100}])');
 assert.equal(a.run('pages.length'),0);assert.deepEqual(a.revoked,['bad.heic']);
 assert.match(a.elements.status.textContent,/HEIC/);assert.equal(a.elements.clear.disabled,false);
 await a.run('add([{name:"not-image.pdf",type:"application/pdf",size:100}])');
 assert.match(a.elements.status.textContent,/不是支援/);assert.equal(a.elements.pdf.disabled,true);
});
test('imports enforce file, total size, page and decoded pixel limits',async()=>{
 const a=app();
 await a.run('add([{name:"huge.png",type:"image/png",size:21*1024*1024}])');
 assert.match(a.elements.status.textContent,/20 MiB/);
 a.run('pages=Array.from({length:20},(_,i)=>({file:{size:1},url:String(i),rotation:0}))');
 await a.run('add([{name:"extra.png",type:"image/png",size:1}])');assert.match(a.elements.status.textContent,/20 頁/);
 a.run('pages=[{file:{size:80*1024*1024},url:"existing",rotation:0}]');
 await a.run('add([{name:"extra.png",type:"image/png",size:1}])');assert.match(a.elements.status.textContent,/80 MiB/);
 a.run('pages=[]');a.sandbox.Image=class{constructor(){this.naturalWidth=10000;this.naturalHeight=10000}set src(v){queueMicrotask(()=>this.onload())}};
 await a.run('add([{name:"pixels.png",type:"image/png",size:100}])');
 assert.equal(a.run('pages.length'),0);assert.deepEqual(a.revoked,['pixels.png']);assert.match(a.elements.status.textContent,/像素/);
});
test('OCR uses pinned worker/core/model configuration and restores disabled boundary buttons',async()=>{
 const a=app();await a.add(1);let options;
 a.elements.language.value='eng';
 a.sandbox.window.Tesseract={createWorker:async(l,o,c)=>{options={l,o,c};return{recognize:async()=>({data:{text:'test'}}),terminate:async()=>{}}}};
 // Include the page-boundary controls in the lock snapshot.
 const buttons=a.elements.pages.children[0].children.slice(2);
 a.sandbox.document.querySelectorAll=()=>[...Object.values(a.elements),...buttons];
 await a.elements.ocr.onclick();
 assert.equal(options.l,'eng');assert.equal(options.o,1);assert.match(options.c.workerPath,/@5.1.1/);assert.match(options.c.corePath,/@5.1.1/);
 assert.match(options.c.langPath,/e12c65a915945e4c28e237a9b52bc4a8f39a0cec/);assert.equal(options.c.gzip,false);
 assert.equal(buttons[0].disabled,true);assert.equal(buttons[1].disabled,true);assert.equal(buttons[2].disabled,false);
});
test('vCard supplies required fields, CRLF and safe text escaping',()=>{
 const a=app();
 const card=a.run('buildVCard({name:"王小明",company:"A;B,C",phone:"123",email:"hello@example.com"})');
 assert.match(card,/VERSION:3.0\r\nFN:王小明\r\nN:;王小明;;;/);
 assert.ok(card.includes('ORG:A\\;B\\,C'));assert.ok(card.endsWith('END:VCARD\r\n'));
 const malicious=a.run('buildVCard({name:"A\\r\\nTEL:injected",company:"",phone:"",email:""})');
 assert.equal(malicious.split('\r\n').filter(x=>x.startsWith('TEL:')).length,1);
 assert.throws(()=>a.run('buildVCard({name:" ",company:"only company",phone:"",email:""})'),/請填/);
 assert.match(a.run('buildVCard({name:"",company:"",phone:"123",email:""})'),/FN:123/);
});
test('vCard folding respects UTF-8 bytes and never splits characters',()=>{
 const a=app(),name='王😀'.repeat(40);
 const card=a.run('buildVCard('+JSON.stringify({name,company:'',phone:'',email:''})+')');
 for(const line of card.split('\r\n'))assert.ok(Buffer.byteLength(line,'utf8')<=75);
 const unfolded=card.replace(/\r\n /g,'');assert.ok(unfolded.includes('FN:'+name+'\r\n'));assert.equal(unfolded.includes('�'),false);
});
test('app navigation shows one panel, updates accessible selection and locks during processing',()=>{
 const a=app(),names=['scan','text','card'];
 const panels=names.map(panel=>({dataset:{panel},hidden:panel!=='scan'}));
 const tabs=names.map(view=>({dataset:{view},setAttribute(k,v){this[k]=v},focus(){this.focused=true}}));
 a.sandbox.document.querySelectorAll=selector=>selector==='[data-panel]'?panels:selector==='[role="tab"]'?tabs:[];
 a.run('showView("card",true)');
 assert.deepEqual(panels.map(x=>x.hidden),[true,true,false]);
 assert.equal(tabs[2]['aria-selected'],'true');assert.equal(tabs[2].tabIndex,0);assert.equal(tabs[2].focused,true);assert.equal(tabs[0].tabIndex,-1);
 a.run('busy=true;showView("scan")');assert.equal(panels[2].hidden,false);
 a.run('busy=false;showView("invalid")');assert.equal(panels[2].hidden,false);
});


test('crop is applied to source pixels before rotation without changing the original file',async()=>{
 const a=app();await a.add(1);a.run('pages[0].crop={x:.25,y:.25,width:.5,height:.5};pages[0].rotation=90');
 const dimensions=await a.run('pageCanvas(pages[0]).then(c=>[c.width,c.height])');
 assert.deepEqual(Array.from(dimensions),[200,400]);assert.deepEqual(a.drawCalls.at(-1).slice(1,5),[200,100,400,200]);
 assert.equal(a.run('pages[0].file.name'),'image0');
});
test('partial OCR failure preserves previous page text rather than publishing a half-updated document',async()=>{
 const a=app();await a.add(2);a.run('pages[0].text="old first";pages[1].text="old second"');a.elements.text.value='old editor';let n=0;
 a.sandbox.window.Tesseract={createWorker:async()=>({recognize:async()=>{if(++n===2)throw Error('second failed');return {data:{text:'new first'}}},terminate:async()=>{}})};
 await a.elements.ocr.onclick();assert.equal(a.run('pages[0].text'),'old first');assert.equal(a.elements.text.value,'old editor');assert.match(a.elements.status.textContent,/失敗/);
});

test('camera import auto-crops while album import preserves full image, checkbox opts out',async()=>{
 const a=app();let calls=0;a.sandbox.automaticCameraCrop=()=>{calls++;return{x:.1,y:.1,width:.8,height:.8}};
 a.elements['camera-auto-crop']={checked:true};const file={name:'camera.png',type:'image/png',size:100};
 await a.elements.camera.onchange({target:{files:[file],value:'camera'}});
 assert.equal(a.run('pages[0].crop.width'),.8);assert.equal(a.run('pages[0].file.name'),'camera.png');
 await a.elements.upload.onchange({target:{files:[file],value:'album'}});assert.equal(a.run('pages[1].crop'),null);
 a.elements['camera-auto-crop'].checked=false;await a.elements.camera.onchange({target:{files:[file],value:'camera'}});
 assert.equal(a.run('pages[2].crop'),null);assert.equal(calls,1);
});
test('failed camera edge detection keeps the original imported image and releases controls',async()=>{
 const a=app();a.sandbox.automaticCameraCrop=()=>{throw Error('detector failed')};
 await a.run('add([{name:"safe.png",type:"image/png",size:100}],{autoCrop:true})');
 assert.equal(a.run('pages.length'),1);assert.equal(a.run('pages[0].crop'),null);assert.equal(a.run('pages[0].autoCropState'),'uncertain');assert.equal(a.elements.clear.disabled,false);
});
