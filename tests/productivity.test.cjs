const {test}=require('node:test');
const assert=require('node:assert/strict');
const p=require('../public/productivity-tools.js');
const fs=require('node:fs');
const vm=require('node:vm');
test('duplicate detection uses exact normalized contacts, never name-only or suffixes',()=>{
 assert.equal(p.duplicate({email:' A@EXAMPLE.COM '},{email:'a@example.com'}),'Email 相同');
 assert.equal(p.duplicate({phone:'00886 912-345-678'},{phone:'+886912345678'}),'電話相同');
 assert.equal(p.duplicate({name:'王大明',phone:'0912345678'},{name:'王大明',phone:'+886912345678'}),'');
 assert.equal(p.duplicate({phone:'123'},{phone:'123'}),'');assert.equal(p.duplicate({},{}),'');
});
test('merge follows each selected field including an intentionally empty value',()=>{
 const result=p.mergeContact({name:'New',company:'',phone:'111',email:'new@example.com'},{name:'Old',company:'Corp',phone:'222',email:'old@example.com'},{name:'current',company:'saved',phone:'saved',email:'current'});
 assert.deepEqual(result,{name:'New',company:'Corp',phone:'222',email:'new@example.com'});
 assert.equal(p.mergeContact({company:''},{company:'Old'},{company:'current'}).company,'');
});
test('receipt extracts explicit totals and Gregorian date while ignoring subtotal and change',()=>{
 const result=p.receipt('Date: 2026/10/17\nSubtotal 1,000\nTax 50\nTOTAL TWD 1,050.50\nChange 49.50');
 assert.equal(result.date,'2026-10-17');assert.equal(result.amount,'1050.5');assert.equal(result.currency,'TWD');
 assert.equal(p.receipt('2024年2月29日\n合 計 ¥ 1,200 円').amount,'1200');
 assert.equal(p.receipt('2026-02-30\n合計 100').date,'');
});
test('ambiguous totals/dates and unlabeled prices stay unresolved',()=>{
 const result=p.receipt('2026/10/17\n2026/10/18\nTOTAL 100\n合計 200');
 assert.equal(result.date,'');assert.equal(result.amount,'');assert.equal(result.dates.length,2);assert.equal(result.amounts.length,2);
 assert.equal(p.receipt('Item $500\nID 12345').amount,'');assert.equal(p.receipt('TOTAL 100 200').amount,'');
 assert.equal(p.receipt('TOTAL -100').amount,'');
});
test('ZIP headers, CRC32, Unicode names and exact payload are valid',async()=>{
 const bytes=new TextEncoder().encode('hello 智慧掃描');assert.equal(p.crc32(new TextEncoder().encode('123456789')),0xcbf43926);
 const result=new Uint8Array(await p.zip([{name:'文字.txt',data:bytes}]).arrayBuffer()),view=new DataView(result.buffer),nameLength=view.getUint16(26,true);
 assert.equal(view.getUint32(0,true),0x04034b50);assert.equal(view.getUint16(6,true),0x800);
 assert.equal(new TextDecoder().decode(result.slice(30,30+nameLength)),'文字.txt');
 assert.deepEqual(result.slice(30+nameLength,30+nameLength+bytes.length),bytes);
 assert.equal(view.getUint32(result.length-22,true),0x06054b50);assert.equal(view.getUint16(result.length-14,true),1);
});
test('vendored QR encodes Unicode vCard with UTF-8 ECI and rejects overflow',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('public/vendor/qrcodegen-1.8.0.js','utf8'),ctx);
 const q=ctx.qrcodegen,bytes=[...new TextEncoder().encode('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:測試名片\r\nN:;測試名片;;;\r\nEND:VCARD\r\n')];
 const qr=q.QrCode.encodeSegments([q.QrSegment.makeEci(26),q.QrSegment.makeBytes(bytes)],q.QrCode.Ecc.MEDIUM);
 assert.ok(qr.size>=21);assert.equal(qr.getModule(0,0),true);assert.equal(qr.getModule(1,1),false);
 assert.throws(()=>q.QrCode.encodeBinary(Array(5000).fill(65),q.QrCode.Ecc.MEDIUM));
});
