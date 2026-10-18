"use strict";
(function(root){
 function quality({data,width,height}){
  if(!width||!height||data.length!==width*height*4)throw Error('影像分析尺寸不正確');
  const gray=new Float64Array(width*height);let mean=0,dark=0,light=0;
  for(let i=0;i<gray.length;i++){const v=.2126*data[i*4]+.7152*data[i*4+1]+.0722*data[i*4+2];gray[i]=v;mean+=v;if(v<45)dark++;if(v>250)light++;}
  let sum=0,sum2=0,n=0;
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=y*width+x,v=gray[i-1]+gray[i+1]+gray[i-width]+gray[i+width]-4*gray[i];sum+=v;sum2+=v*v;n++;}
  const variance=n?Math.max(0,sum2/n-(sum/n)**2):0,brightness=mean/gray.length,advice=[];
  if(brightness<75||dark/gray.length>.7)advice.push('影像偏暗，建議補光後重拍');
  if(variance<35)advice.push('細節偏少，可能模糊或空白，請放大核對');
  if(light/gray.length>.45&&variance<150)advice.push('疑似過亮或反光；白紙也可能觸發，請核對文字');
  return{brightness,sharpness:variance,darkRatio:dark/gray.length,brightRatio:light/gray.length,advice};
 }
 function pageRange(value,count){
  if(!Number.isInteger(count)||count<1)throw Error('尚無頁面');
  if(!String(value).trim())return Array.from({length:count},(_,i)=>i);
  const pages=[];
  for(const part of String(value).split(/[,，]/)){
   const m=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!m)throw Error('頁碼請用 1,3-5 格式');
   const a=Number(m[1]),b=Number(m[2]||m[1]);if(a<1||b<a||b>count)throw Error('頁碼超出範圍或區間順序錯誤');
   for(let i=a;i<=b;i++)if(!pages.includes(i-1))pages.push(i-1);
  }
  return pages;
 }
 function rectangles(rects){
  if(!Array.isArray(rects)||rects.length>100)throw Error('遮蔽區域上限 100 個');
  for(const r of rects)if(!r||!['x','y','width','height'].every(k=>Number.isFinite(r[k]))||r.x<0||r.y<0||r.width<=0||r.height<=0||r.x+r.width>1.00001||r.y+r.height>1.00001)throw Error('遮蔽範圍必須在影像內');
  return rects;
 }
 function burn(canvas,rects){
  rectangles(rects);const c=canvas.getContext('2d');c.save();c.setTransform(1,0,0,1,0,0);c.fillStyle='#000';
  for(const r of rects){const x=Math.floor(r.x*canvas.width),y=Math.floor(r.y*canvas.height),right=Math.ceil((r.x+r.width)*canvas.width),bottom=Math.ceil((r.y+r.height)*canvas.height);c.fillRect(x,y,right-x,bottom-y);}
  c.restore();return canvas;
 }
 async function fileHash(file){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');}
 async function documentHash(record){const hashes=[];for(const p of record.pages)hashes.push([await fileHash(p.file),p.rotation,p.crop||null,p.perspective||null]);return JSON.stringify(hashes);}
 const statuses={draft:'草稿',pending:'待報帳',submitted:'已送出',approved:'已核准',paid:'已撥款'};
 const money=value=>{const s=String(value??'');if(!/^\d+(\.\d{1,2})?$/.test(s)||!Number.isSafeInteger(Math.round(Number(s)*100)))throw Error('金額須為非負數且最多兩位小數');return Math.round(Number(s)*100);};
 function receipt(receipt){
  const r={...receipt};if(r.amount)money(r.amount);if(r.tax){const tax=money(r.tax);if(!r.amount||tax>money(r.amount))throw Error('稅額不可超過總金額');}
  if(!Object.hasOwn(statuses,r.status))throw Error('請選擇報帳狀態');
  for(const k of ['store','payment','note','reference'])if(typeof r[k]!=='string'||r[k].length>1000)throw Error('報帳欄位格式不正確');
  return r;
 }
 const api={quality,pageRange,rectangles,burn,fileHash,documentHash,statuses,money,receipt};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SmartScanEight=api;
})(globalThis);
