"use strict";
(function(root){
 const MAX_RAW=128*1024*1024,MAX_FILE=192*1024*1024;
 const error=()=>Error('備份格式不支援或內容損壞，未變更本機資料');
 const parse=text=>JSON.parse(text,(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw error();return v;});
 async function digest(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');}
 function validateRecord(r){
  if(!r||typeof r.id!=='string'||!(/^[A-Za-z0-9_-]{1,100}$/).test(r.id)||!Array.isArray(r.pages)||r.pages.length>20||typeof r.name!=='string'||r.name.length>150||typeof r.text!=='string'||r.text.length>2000000||!Number.isFinite(r.createdAt)||!Number.isFinite(r.updatedAt)||!['document','receipt','card','other'].includes(r.category)||!['document','card'].includes(r.mode)||!['eng','chi_tra+eng','jpn+eng','chi_tra+eng+jpn'].includes(r.language))throw error();
  if(r.contact&&(['name','company','phone','email'].some(k=>typeof r.contact[k]!=='string')))throw error();
  if(r.kind && r.kind!=='contact')throw error();
  if(r.tags&&(!Array.isArray(r.tags)||r.tags.length>12||r.tags.some(t=>typeof t!=='string'||t.length>24)))throw error();
  for(const key of ['receipt','translation'])if(r[key]&&(typeof r[key]!=='object'||Array.isArray(r[key])||Object.values(r[key]).some(v=>typeof v!=='string')))throw error();
  if(r.advanced){
   const a=r.advanced;
   if(typeof a!=='object'||Array.isArray(a)||!a.values||typeof a.values!=='object'||Array.isArray(a.values)||Object.values(a.values).some(v=>typeof v!=='string')||typeof a.allDay!=='boolean'||!Array.isArray(a.tableRows)||a.tableRows.length>10000||a.tableRows.some(row=>!Array.isArray(row)||row.length>1000||row.some(v=>typeof v!=='string'))||!Array.isArray(a.barcodeResults)||a.barcodeResults.length>10000||a.barcodeResults.some(v=>!v||!Number.isFinite(v.page)||typeof v.text!=='string'||typeof v.format!=='string'))throw error();
  }

  for(const p of r.pages){if(!(p.file instanceof Blob)||!p.file.size)throw error();}
  return r;
 }
 async function encode(snapshot){
  let raw=0;
  if(snapshot.documents.length>2000||snapshot.drafts.length>200)throw Error('單次最多 2000 份文件及 200 份草稿');
  const record=async r=>{validateRecord(r);for(const p of r.pages){raw+=p.file.size;if(raw>MAX_RAW)throw Error('備份原圖總量超過 128 MiB，請分批整理文件庫後備份');}const pages=[];let size=0;
   for(const p of r.pages){size+=p.file.size;if(p.file.size>20*1024*1024||size>80*1024*1024)throw Error('單份文件上限 80 MiB、單張 20 MiB');const bytes=new Uint8Array(await p.file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));pages.push({...p,file:{name:p.file.name||'scan',type:p.file.type,lastModified:p.file.lastModified||0,data:btoa(binary)}});}
   return {schema:1,record:{...r,pages}};};
  const documents=[];for(const r of snapshot.documents)documents.push(await record(r));
  const drafts=[];for(const d of snapshot.drafts)drafts.push({...d,record:await record(d.record)});
  const payload=JSON.stringify({createdAt:Date.now(),documents,drafts,settings:snapshot.settings||{}});
  const result=JSON.stringify({format:'smartscan-full-backup',version:1,sha256:await digest(payload),payload});
  if(new Blob([result]).size>MAX_FILE)throw Error('備份超過 192 MiB 限制');
  return new Blob([result],{type:'application/json'});
 }
 async function decode(file){
  if(file.size>MAX_FILE)throw Error('備份檔超過 192 MiB 限制');
  const envelope=parse(await file.text());
  if(envelope.format!=='smartscan-full-backup'||envelope.version!==1||typeof envelope.payload!=='string'||await digest(envelope.payload)!==envelope.sha256)throw error();
  const data=parse(envelope.payload);
  if(!Array.isArray(data.documents)||!Array.isArray(data.drafts)||data.documents.length>2000||data.drafts.length>200||!Number.isFinite(data.createdAt))throw error();
  let raw=0;const ids=new Set();
  function record(e){
   if(e?.schema!==1||!e.record||!Array.isArray(e.record.pages)||e.record.pages.length>20)throw error();
   let size=0;
   const pages=e.record.pages.map(p=>{
    const f=p.file;
    if(!f||typeof f.name!=='string'||f.name.length>1000||typeof f.type!=='string'||f.type.length>100||(f.type&&!f.type.startsWith('image/'))||typeof f.data!=='string'||f.data.length>28*1024*1024||f.data.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(f.data)||![0,90,180,270].includes(p.rotation))throw error();
    const binary=atob(f.data);size+=binary.length;raw+=binary.length;
    if(binary.length>20*1024*1024||size>80*1024*1024||raw>MAX_RAW)throw error();
    if(p.crop&&(!['x','y','width','height'].every(k=>Number.isFinite(p.crop[k]))||p.crop.x<0||p.crop.y<0||p.crop.width<=0||p.crop.height<=0||p.crop.x+p.crop.width>1.001||p.crop.y+p.crop.height>1.001))throw error();
    if(p.perspective){if(!root.SmartScanPro)throw error();root.SmartScanPro.quad(p.perspective);}
    if(p.text!==undefined&&typeof p.text!=='string')throw error();
    if(p.words!==undefined&&(!Array.isArray(p.words)||p.words.length>100000||p.words.some(w=>!w||typeof w.text!=='string'||!w.bbox||!['x0','y0','x1','y1'].every(k=>Number.isFinite(w.bbox[k])))))throw error();
    return {...p,file:new File([Uint8Array.from(binary,c=>c.charCodeAt(0))],f.name,{type:f.type,lastModified:Number(f.lastModified)||0})};
   });
   return validateRecord({...e.record,pages});
  }
  data.documents=data.documents.map(e=>{const r=record(e);if(ids.has(r.id))throw error();ids.add(r.id);return r;});
  data.drafts=data.drafts.map(d=>{if(!d||typeof d.id!=='string'||!Number.isFinite(d.updatedAt)||!d.ui||typeof d.ui!=='object'||Array.isArray(d.ui)||Object.entries(d.ui).some(([k,v])=>k.length>100||!['string','boolean'].includes(typeof v)||String(v).length>2000000)||(d.documentId!==null&&typeof d.documentId!=='string'))throw error();return {...d,record:record(d.record)};});
  if(!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings)||Object.keys(data.settings).some(k=>k!=='name-template'||typeof data.settings[k]!=='string'||data.settings[k].length>120))throw error();
  return data;
 }
 const api={encode,decode,digest,validateRecord,MAX_FILE};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SmartScanRecoveryTools=api;
})(globalThis);
