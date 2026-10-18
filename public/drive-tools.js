"use strict";
(function(root){
 const MAX=80*1024*1024;
 async function encode(record){let size=0;const pages=[];for(const page of record.pages||[]){if(!(page.file instanceof Blob))throw Error('文件影像遺失');size+=page.file.size;if(page.file.size>20*1024*1024||size>MAX)throw Error('單份同步上限80MB，每張20MB');const bytes=new Uint8Array(await page.file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));pages.push({...page,file:{name:page.file.name||'scan.jpg',type:page.file.type,lastModified:page.file.lastModified||0,data:btoa(binary)}});}return JSON.stringify({schema:1,record:{...record,pages}});}
 function decode(text){
  if(text.length>120*1024*1024)throw Error('雲端文件過大');
  const envelope=JSON.parse(text,(key,value)=>{if(['__proto__','constructor','prototype'].includes(key))throw Error('不安全的文件欄位');return value;});
  const r=envelope?.record;if(envelope.schema!==1||!r||typeof r.id!=='string'||!(/^[A-Za-z0-9_-]{1,100}$/).test(r.id)||['__proto__','constructor','prototype'].includes(r.id)||typeof r.name!=='string'||r.name.length>150||!Number.isFinite(r.updatedAt)||typeof r.text!=='string'||r.text.length>2000000||!Array.isArray(r.pages)||r.pages.length>20)throw Error('雲端文件格式不支援');
  if(r.tags&&(!Array.isArray(r.tags)||r.tags.length>12||r.tags.some(x=>typeof x!=='string'||x.length>24)))throw Error('標籤格式錯誤');
  let total=0;r.pages=r.pages.map(p=>{const f=p.file;if(!f||typeof f.data!=='string'||f.data.length>28*1024*1024||typeof f.type!=='string'||!f.type.startsWith('image/')||![0,90,180,270].includes(p.rotation))throw Error('雲端影像格式錯誤');const binary=atob(f.data);total+=binary.length;if(binary.length>20*1024*1024||total>MAX)throw Error('雲端影像超出限制');if(p.perspective)root.SmartScanPro.quad(p.perspective);if(p.crop&&(!['x','y','width','height'].every(k=>Number.isFinite(p.crop[k]))||p.crop.x<0||p.crop.y<0||p.crop.width<=0||p.crop.height<=0||p.crop.x+p.crop.width>1.001||p.crop.y+p.crop.height>1.001))throw Error('裁切範圍無效');return{...p,file:new File([Uint8Array.from(binary,c=>c.charCodeAt(0))],String(f.name||'scan.jpg').slice(0,150),{type:f.type,lastModified:Number(f.lastModified)||0})};});return r;
 }
 function decision(local,remote,base){const version=local?.syncRevision||local?.updatedAt;if(!remote)return local?'upload':'none';if(!local)return base?'none':'download';if(base&&base.remote===remote.id){return version===base.local?'none':'upload';}if(base&&version===base.local&&remote.descends!==false)return'download';return'conflict';}
 const api={encode,decode,decision};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SmartScanDriveTools=api;
})(globalThis);
