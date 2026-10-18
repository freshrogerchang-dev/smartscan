const {test}=require('node:test');
const assert=require('node:assert/strict');
const recovery=require('../public/recovery-tools.js');
function fixture(type='image/png'){
 return {id:'original',name:'測試文件',category:'document',text:'原文測試',createdAt:1,updatedAt:2,language:'chi_tra+eng',mode:'document',tags:['工作'],contact:{name:'小明',company:'測試',phone:'123',email:''},pages:[{rotation:90,crop:{x:0,y:0,width:.8,height:.9},file:new File(['original-image-bytes'],'測試.png',{type,lastModified:12345}),text:'原文測試',words:[]}],advanced:{values:{'ai-result':'草稿'},allDay:false,tableRows:[],barcodeResults:[]}};
}
test('backup round-trip retains original file bytes, names, MIME, dates, metadata and draft UI',async()=>{
 const r=fixture('');const d={id:'draft-one',updatedAt:3,documentId:r.id,record:r,ui:{text:'未儲存文字', 'searchable-pdf':true}};
 const data=await recovery.decode(await recovery.encode({documents:[r],drafts:[d],settings:{'name-template':'{date}_{title}'}}));
 assert.equal(await data.documents[0].pages[0].file.text(),'original-image-bytes');assert.equal(data.documents[0].pages[0].file.name,'測試.png');assert.equal(data.documents[0].pages[0].file.type,'');assert.equal(data.documents[0].pages[0].file.lastModified,12345);
 assert.equal(data.drafts[0].ui.text,'未儲存文字');assert.equal(data.documents[0].pages[0].rotation,90);assert.deepEqual(data.documents[0].tags,['工作']);
});
test('checksum mismatch, unknown versions and prototype keys are rejected before import',async()=>{
 const blob=await recovery.encode({documents:[fixture()],drafts:[]});const envelope=JSON.parse(await blob.text());
 envelope.payload=envelope.payload.replace('原文測試','錯誤文字');await assert.rejects(recovery.decode(new Blob([JSON.stringify(envelope)])),/損壞/);
 envelope.version=999;await assert.rejects(recovery.decode(new Blob([JSON.stringify(envelope)])),/不支援/);
 await assert.rejects(recovery.decode(new Blob(['{"__proto__":{}}'])),/損壞/);
});
test('validly hashed but invalid page geometry is rejected',async()=>{
 const envelope=JSON.parse(await(await recovery.encode({documents:[fixture()],drafts:[]})).text());
 const data=JSON.parse(envelope.payload);data.documents[0].record.pages[0].crop.width=2;
 envelope.payload=JSON.stringify(data);envelope.sha256=await recovery.digest(envelope.payload);
 await assert.rejects(recovery.decode(new Blob([JSON.stringify(envelope)])),/損壞/);
});
test('empty backup is valid; oversize input is rejected without reading',async()=>{
 const data=await recovery.decode(await recovery.encode({documents:[],drafts:[]}));assert.equal(data.documents.length,0);
 await assert.rejects(recovery.decode({size:recovery.MAX_FILE+1,text(){throw Error('should not read');}}),/192/);
});
