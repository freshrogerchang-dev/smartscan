const {test}=require('node:test');
const assert=require('node:assert/strict');
const tools=require('../public/document-tools.js');
test('filename suggestions use valid OCR dates, safe names and editable category hints',()=>{
 const now=new Date(2026,9,17);
 const receipt=tools.suggest('發票 2025/02/28\nTotal 120','scan.png','document',now);
 assert.equal(receipt.category,'receipt');assert.ok(receipt.name.startsWith('2025-02-28_收據_'));
 assert.ok(tools.suggest('2025/02/30','x.png','document',now).name.startsWith('2026-10-17_'));
 assert.equal(tools.classify('hello@example.com\n電話 +886 912345678','document'),'card');
 assert.equal(tools.classify('any text','card'),'card');
 assert.equal(/[\\/:*?"<>|\x00-\x1f]/.test(tools.safeName('a/b:c\n..')),false);
});
test('full-text search handles CJK, width/case and multiple terms without HTML matching',()=>{
 const record={name:'會議紀錄',category:'document',text:'合約金額 ABC １２３'};
 assert.equal(tools.matches(record,'合約 abc 123'),true);
 assert.equal(tools.matches(record,'金額','receipt'),false);
 assert.equal(tools.matches(record,'不存在'),false);
 assert.equal(tools.matches(record,''),true);
 assert.equal(tools.matches({name:'掃描',category:'document',text:'智 慧 掃描\nスマ ー ト スキ ャ ン'},'智慧掃描'),true);
 assert.equal(tools.matches({name:'掃描',category:'document',text:'スマ ー ト スキ ャ ン'},'スマートスキャン'),true);
 assert.equal(tools.pdfText('智 慧 掃描\nInvoice 12345'),'智慧掃描\nInvoice 12345');
});
test('crop detects a light sheet, keeps text holes and returns normalized reversible bounds',()=>{
 const width=100,height=80,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const value=x>=20&&x<80&&y>=15&&y<65?245:60,i=(y*width+x)*4;
   data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
 }
 for(let x=30;x<65;x++){const i=(30*width+x)*4;data[i]=data[i+1]=data[i+2]=0;}
 const bounds=tools.detectBounds({data,width,height});
 assert.ok(bounds.x<=.2&&bounds.x>.1);assert.ok(bounds.y<=15/80&&bounds.y>.05);
 assert.ok(bounds.x+bounds.width>=.8);assert.ok(bounds.width<.8);assert.ok(bounds.height<.9);
});
test('crop refuses featureless or ambiguous full-frame images',()=>{
 for(const value of [0,255]){
  const data=new Uint8ClampedArray(100*80*4).fill(value);
  assert.equal(tools.detectBounds({data,width:100,height:80}),null);
 }
 assert.equal(tools.detectBounds({data:[],width:100,height:80}),null);
});

test('automatic crop accepts a fully visible contrasted sheet, refuses low contrast or clipped paper',()=>{
 const sample=(bg,paper,left=20)=>{const width=100,height=80,data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,v=x>=left&&x<80&&y>=15&&y<65?paper:bg;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}return{data,width,height};};
 const bounds=tools.autoCropBounds(sample(60,245));assert.ok(bounds);assert.ok(bounds.x<=.2&&bounds.x+bounds.width>=.8);
 assert.equal(tools.autoCropBounds(sample(225,245)),null);assert.equal(tools.autoCropBounds(sample(60,245,0)),null);
});
