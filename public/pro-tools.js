"use strict";
(function(root){
 const tags=value=>[...new Set((Array.isArray(value)?value:String(value||'').split(/[,，、#\n]/)).map(x=>String(x).normalize('NFC').trim().slice(0,24)).filter(Boolean))].slice(0,12);
 function filename(pattern,{date,category,title,tags:labels=[]}){
  if(!pattern.trim()||pattern.length>120)throw Error('範本請輸入1–120字');
  if(/[{}]/.test(pattern.replace(/\{(date|category|title|tags)\}/g,'')))throw Error('只支援 {date}、{category}、{title}、{tags}');
  return pattern.replace(/\{(date|category|title|tags)\}/g,(_,key)=>({date,category,title,tags:tags(labels).join('-')}[key]||''));
 }
 function report(records,from='',to='',category='all'){
  const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  if((from&&!validDate(from))||(to&&!validDate(to)))throw Error('日期格式不正確');
  if(from&&to&&from>to)throw Error('開始日期不可晚於結束日期');
  const rows=records.filter(r=>validDate(r.receipt?.date)&&(!from||r.receipt.date>=from)&&(!to||r.receipt.date<=to)&&(category==='all'||tags(r.tags).includes(category))).sort((a,b)=>a.receipt.date.localeCompare(b.receipt.date)).map(r=>{
   const amount=String(r.receipt.amount??'');if(!/^\d+(\.\d{1,2})?$/.test(amount)||!Number.isSafeInteger(Math.round(Number(amount)*100)))return null;
   return {id:r.id,name:r.name,date:r.receipt.date,currency:/^[A-Z]{3}$/.test(r.receipt.currency)?r.receipt.currency:'未指定',amount:Number(amount),tags:tags(r.tags).join('、')};
  }).filter(Boolean);
  const totals=Object.create(null);for(const row of rows){const sum=(totals[row.currency]||0)+Math.round(row.amount*100);if(!Number.isSafeInteger(sum))throw Error('合計金額超過安全計算範圍，請縮小日期區間');totals[row.currency]=sum;}
  return {rows,totals:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,v/100]))};
 }
 function quad(points){
  if(!Array.isArray(points)||points.length!==4||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1))throw Error('四角必須在影像內');
  const cross=points.map((p,i)=>{const b=points[(i+1)%4],c=points[(i+2)%4];return (b.x-p.x)*(c.y-b.y)-(b.y-p.y)*(c.x-b.x);});
  if(cross.some(v=>v<=.0001))throw Error('請依左上、右上、右下、左下排列，四角不可交叉或太靠近');return points;
 }
 function homography(points){
  quad(points);const dest=[[0,0],[1,0],[1,1],[0,1]],m=[];
  dest.forEach(([u,v],i)=>{const {x,y}=points[i];m.push([u,v,1,0,0,0,-u*x,-v*x,x],[0,0,0,u,v,1,-u*y,-v*y,y]);});
  for(let c=0;c<8;c++){let p=c;for(let r=c+1;r<8;r++)if(Math.abs(m[r][c])>Math.abs(m[p][c]))p=r;[m[c],m[p]]=[m[p],m[c]];if(Math.abs(m[c][c])<1e-10)throw Error('四角無法校正');const d=m[c][c];for(let k=c;k<9;k++)m[c][k]/=d;for(let r=0;r<8;r++)if(r!==c){const f=m[r][c];for(let k=c;k<9;k++)m[r][k]-=f*m[c][k];}}
  return m.map(row=>row[8]);
 }
 const project=(h,u,v)=>{const d=h[6]*u+h[7]*v+1;return{x:(h[0]*u+h[1]*v+h[2])/d,y:(h[3]*u+h[4]*v+h[5])/d};};
 function warp(source,points,max=2400){
  quad(points);const dist=(a,b)=>Math.hypot((a.x-b.x)*source.width,(a.y-b.y)*source.height),w=Math.max(dist(points[0],points[1]),dist(points[3],points[2])),h=Math.max(dist(points[0],points[3]),dist(points[1],points[2])),scale=Math.min(1,max/Math.max(w,h));
  const width=Math.max(2,Math.round(w*scale)),height=Math.max(2,Math.round(h*scale)),data=new Uint8ClampedArray(width*height*4),matrix=homography(points);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=project(matrix,x/(width-1),y/(height-1)),sx=Math.max(0,Math.min(source.width-1,p.x*(source.width-1))),sy=Math.max(0,Math.min(source.height-1,p.y*(source.height-1))),ix=Math.floor(sx),iy=Math.floor(sy),dx=sx-ix,dy=sy-iy;
   for(let c=0;c<4;c++){const at=(a,b)=>source.data[(Math.min(source.height-1,b)*source.width+Math.min(source.width-1,a))*4+c];data[(y*width+x)*4+c]=at(ix,iy)*(1-dx)*(1-dy)+at(ix+1,iy)*dx*(1-dy)+at(ix,iy+1)*(1-dx)*dy+at(ix+1,iy+1)*dx*dy;}
  }return{data,width,height};
 }
 const api={tags,filename,report,quad,homography,project,warp};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SmartScanPro=api;
})(globalThis);
