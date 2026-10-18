"use strict";
(function(){
 const T=window.SmartScanEight;
 const tell=(id,text)=>$(id).textContent=text;
 const canvasBlob=(canvas,type='image/png',quality=.9)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('無法產生影像')),type,quality));
 const selectPage=id=>{const n=Number($(id).value);if(!Number.isInteger(n)||n<1||n>pages.length)throw Error('請選擇存在的頁碼');return pages[n-1];};
 let qualityGeneration=0;
 async function checkQuality(){
  const generation=++qualityGeneration,original=pages.slice(),results=[];
  for(let i=0;i<original.length;i++){
   const canvas=await pageCanvas(original[i]),small=document.createElement('canvas'),scale=Math.min(1,384/Math.max(canvas.width,canvas.height));small.width=Math.max(3,Math.round(canvas.width*scale));small.height=Math.max(3,Math.round(canvas.height*scale));
   const ctx=small.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,small.width,small.height);const q=T.quality(ctx.getImageData(0,0,small.width,small.height));
   if(Math.min(canvas.width,canvas.height)<600)q.advice.push('圖片短邊低於 600 px，細字可能難以辨識');
   results.push(`第 ${i+1} 頁：${q.advice.join('；')||'未偵測到明顯偏暗或細節不足，仍請核對文字'}`);
  }
  if(generation!==qualityGeneration||original.some((p,i)=>pages[i]!==p))return;
  $('quality-results').replaceChildren();for(const text of results){const li=document.createElement('li');li.textContent=text;$('quality-results').append(li);}
  tell('quality-message',results.length?`已檢查 ${results.length} 頁；提醒不等於 OCR 品質保證`:'請先匯入圖片');
 }
 $('quality-check').onclick=()=>checkQuality().catch(e=>tell('quality-message',e.message));
 const addWithQuality=add;add=async function(files,options){await addWithQuality(files,options);if(!busy)await checkQuality().catch(e=>tell('quality-message',e.message));};
 // Backup and recovery (#1/#3) already wrap the editor and library. Keep new fields in that snapshot too.
 let pdfTask=null,pdfCancelled=false;
 $('pdf-import-cancel').onclick=()=>{pdfCancelled=true;pdfTask?.destroy();};
 $('pdf-import').onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file||busy)return;
  const staged=[];lock(true);pdfCancelled=false;$('pdf-import-cancel').hidden=false;$('pdf-import-cancel').disabled=false;
  try{
   if(file.size>40*1024*1024)throw Error('PDF 上限 40 MiB');
   if($('text').value.trim()&&pages.length)syncEditor();
   tell('pdf-organize-message','正在載入 PDF…');
   const lib=await import('/vendor/pdfjs/pdf.mjs');lib.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';
   pdfTask=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,enableXfa:false,useWorkerFetch:false});
   let password=false;pdfTask.onPassword=()=>{password=true;pdfTask.destroy();};
   let doc;try{doc=await pdfTask.promise;}catch(e){if(password)throw Error('此 PDF 需要密碼，請先解鎖後匯入');throw e;}
   if(pages.length+doc.numPages>config.maxPages)throw Error('合計最多 20 頁；請先拆分 PDF');
   let total=pages.reduce((n,p)=>n+p.file.size,0);
   for(let i=1;i<=doc.numPages;i++){
    if(pdfCancelled)throw Error('已取消匯入');tell('pdf-organize-message',`匯入 PDF ${i}/${doc.numPages}`);
    const source=await doc.getPage(i),v=source.getViewport({scale:1}),scale=Math.min(2,2400/Math.max(v.width,v.height)),viewport=source.getViewport({scale});
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));
    await source.render({canvasContext:canvas.getContext('2d'),viewport,background:'white'}).promise;
    const blob=await canvasBlob(canvas,'image/jpeg',.92);total+=blob.size;
    if(total>config.maxTotalBytes||blob.size>config.maxFileBytes)throw Error('轉換後影像超過容量限制，未匯入任何頁面');
    const image=new File([blob],tools.safeName(file.name.replace(/\.pdf$/i,''))+'-'+i+'.jpg',{type:'image/jpeg'});
    staged.push({file:image,url:URL.createObjectURL(image),rotation:0,crop:null,text:'',words:[]});source.cleanup();canvas.width=canvas.height=1;
   }
   if(pdfCancelled)throw Error('已取消匯入');
   pages.push(...staged);staged.length=0;refreshEditor();markDirty();render();tell('pdf-organize-message',`已匯入 ${doc.numPages} 頁圖片，可與照片排序合併；原始 PDF 未保存於工作區`);
  }catch(e){tell('pdf-organize-message',pdfCancelled?'已取消匯入，原有頁面保留':'PDF 匯入失敗：'+e.message);}
  finally{staged.forEach(p=>URL.revokeObjectURL(p.url));try{await pdfTask?.destroy();}catch{}pdfTask=null;$('pdf-import-cancel').hidden=true;lock(false);updateDocumentControls();}
 };
 async function selectedPdf(indices){
  if(!window.jspdf)throw Error('PDF 程式無法載入');const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4'});
  for(let i=0;i<indices.length;i++){if(i)pdf.addPage();const c=await pageCanvas(pages[indices[i]]),fit=Math.min(210/c.width,297/c.height);pdf.addImage(c.toDataURL('image/jpeg',.9),'JPEG',(210-c.width*fit)/2,(297-c.height*fit)/2,c.width*fit,c.height*fit);}
  return pdf;
 }
 for(const [id,split]of [['pdf-range-export',false],['pdf-split',true]])$(id).onclick=async()=>{
  if(busy)return;lock(true);
  try{const indices=T.pageRange($('pdf-range').value,pages.length);if(split){const entries=[];for(const index of indices){const pdf=await selectedPdf([index]);entries.push({name:`page-${index+1}.pdf`,data:new Uint8Array(pdf.output('arraybuffer'))});}downloadBlob(new Blob([productivity.zip(entries)],{type:'application/zip'}),'smartscan-pages.zip');}else(await selectedPdf(indices)).save('smartscan-selected.pdf');tell('pdf-organize-message',`已匯出 ${indices.length} 頁（圖片 PDF，不含原始 PDF 文字層）`);}
  catch(e){tell('pdf-organize-message',e.message);}finally{lock(false);}
 };
 let reviewPage=null,reviewCanvas=null,reviewVersion='',reviewEditor='',reviewGeneration=0;
 function pageVersion(page){return JSON.stringify([page.rotation,page.crop||null,page.perspective||null,page.text||'',page.ocrKey||null]);}
 function reviewPaint(box){const c=$('review-image'),ctx=c.getContext('2d');ctx.drawImage(reviewCanvas,0,0,c.width,c.height);if(box){const sx=c.width/reviewCanvas.width,sy=c.height/reviewCanvas.height;ctx.fillStyle='rgba(255,180,0,.35)';ctx.fillRect(box.x0*sx,box.y0*sy,(box.x1-box.x0)*sx,(box.y1-box.y0)*sy);ctx.strokeStyle='#b34b00';ctx.lineWidth=2;ctx.strokeRect(box.x0*sx,box.y0*sy,(box.x1-box.x0)*sx,(box.y1-box.y0)*sy);}}
 $('review-open').onclick=async()=>{
  if(busy)return;const generation=++reviewGeneration;
  try{if($('text').value.trim())syncEditor();const target=selectPage('review-page'),canvas=await pageCanvas(target);if(generation!==reviewGeneration||!pages.includes(target))return;reviewPage=target;reviewCanvas=canvas;reviewVersion=pageVersion(target);reviewEditor=$('text').value;
   const c=$('review-image'),scale=Math.min(1,640/Math.max(canvas.width,canvas.height));c.width=Math.round(canvas.width*scale);c.height=Math.round(canvas.height*scale);reviewPaint();$('review-text').value=target.text||'';$('review-words').replaceChildren();
   const valid=target.ocrKey===JSON.stringify([target.rotation,target.crop||null,target.perspective||null])&&target.ocrWidth===canvas.width&&target.ocrHeight===canvas.height;
   if(valid)for(const word of target.words||[]){const button=document.createElement('button');button.className='word-chip';button.textContent=word.text;button.onclick=()=>{if(!pages.includes(target)||pageVersion(target)!==reviewVersion)return tell('review-message','頁面已變更，請重新載入對照');reviewPaint(word.bbox);};$('review-words').append(button);}
   tell('review-message',valid&&target.words?.length?'點選文字可標示原圖位置；修改後不沿用舊座標':'此頁沒有有效文字座標，可對照原圖校正全文');
  }catch(e){tell('review-message',e.message);}
 };
 $('review-save').onclick=()=>{try{
  if(busy||!reviewPage||!pages.includes(reviewPage)||(pageVersion(reviewPage)!==reviewVersion||$('text').value!==reviewEditor))throw Error('頁面已變更，請重新載入對照');
  reviewPage.text=$('review-text').value;reviewPage.words=[];reviewPage.ocrKey=null;refreshEditor();markDirty();reviewVersion=pageVersion(reviewPage);reviewEditor=$('text').value;$('review-words').replaceChildren();reviewPaint();tell('review-message','已保存此頁校正，舊座標已清除；請另儲存文件庫');
 }catch(e){tell('review-message',e.message);}};
 let redactPage=null,redactCanvas=null,redactVersion='',redactBoxes=[],redactStart=null;
 function drawRedact(){const c=$('redact-image');if(!redactCanvas)return;const ctx=c.getContext('2d');ctx.drawImage(redactCanvas,0,0,c.width,c.height);T.burn(c,redactBoxes);tell('redact-message',`預覽 ${redactBoxes.length} 個區域，尚未改動原圖`);}
 $('redact-open').onclick=async()=>{if(busy)return;try{const target=selectPage('redact-page'),canvas=await pageCanvas(target);if(!pages.includes(target))return;redactPage=target;redactCanvas=canvas;redactVersion=pageVersion(target);redactBoxes=[];const c=$('redact-image'),scale=Math.min(1,640/Math.max(canvas.width,canvas.height));c.width=Math.round(canvas.width*scale);c.height=Math.round(canvas.height*scale);drawRedact();}catch(e){tell('redact-message',e.message);}};
 $('redact-add').onclick=()=>{try{if(!redactCanvas)throw Error('請先載入預覽');const r=Object.fromEntries(['x','y','width','height'].map(k=>[k,Number($('redact-'+k).value)/100]));T.rectangles([...redactBoxes,r]);redactBoxes.push(r);drawRedact();}catch(e){tell('redact-message',e.message);}};
 const rc=$('redact-image'),point=e=>{const r=rc.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
 rc.onpointerdown=e=>{if(!redactCanvas||busy)return;redactStart=point(e);rc.setPointerCapture(e.pointerId);};rc.onpointerup=e=>{if(!redactStart||!redactCanvas)return;const end=point(e),r={x:Math.min(end.x,redactStart.x),y:Math.min(end.y,redactStart.y),width:Math.abs(end.x-redactStart.x),height:Math.abs(end.y-redactStart.y)};redactStart=null;if(r.width<.003||r.height<.003)return;try{T.rectangles([...redactBoxes,r]);redactBoxes.push(r);drawRedact();}catch(error){tell('redact-message',error.message);}};rc.onpointercancel=()=>{redactStart=null;};
 $('redact-page').oninput=()=>{redactPage=null;redactCanvas=null;redactBoxes=[];rc.width=rc.height=1;tell('redact-message','頁碼已變更，請重新載入');};
 $('review-page').oninput=()=>{reviewPage=null;reviewCanvas=null;$('review-words').replaceChildren();$('review-text').value='';tell('review-message','頁碼已變更，請重新載入');};
 $('redact-reset').onclick=()=>{redactBoxes=[];drawRedact();};
 $('redact-apply').onclick=async()=>{
  if(busy)return;
  if(!redactPage||!pages.includes(redactPage)||pageVersion(redactPage)!==redactVersion)return tell('redact-message','頁面已變更，請重新載入預覽');
  if(!redactBoxes.length)return tell('redact-message','請先加入遮蔽區域');
  if(!confirm('製作遮蔽副本？本工作區此頁原圖會被替換，此頁 OCR 與衍生欄位會清除。文件庫原件仍保留，完整備份可能包含原件。'))return;
  lock(true);
  try{if($('text').value.trim())syncEditor();const canvas=await pageCanvas(redactPage);T.burn(canvas,redactBoxes);const blob=await canvasBlob(canvas),file=new File([blob],'redacted-page.png',{type:'image/png'});if(file.size>config.maxFileBytes||pages.reduce((n,p)=>n+(p===redactPage?0:p.file.size),0)+file.size>config.maxTotalBytes)throw Error('遮蔽後圖片過大，請先縮小圖片');
   const replacement={file,url:URL.createObjectURL(file),rotation:0,crop:null,perspective:null,text:'',words:[],redacted:true};
   const at=pages.indexOf(redactPage);URL.revokeObjectURL(redactPage.url);pages[at]=replacement;currentDocumentId=null;$('document-name').value='遮蔽文件';$('document-tags').value='';
   for(const id of ['name','company','phone','email'])$(id).value='';resetProductivity();resetAdvanced();updateCardPreview();refreshEditor();$('searchable-pdf').checked=false;markDirty();render();
   redactPage=null;redactCanvas=null;redactBoxes=[];rc.width=rc.height=1;reviewPage=null;reviewCanvas=null;$('review-words').replaceChildren();$('review-text').value='';$('review-image').width=$('review-image').height=1;
   tell('redact-message','已建立像素遮蔽副本，已移除本頁 OCR 與衍生欄位。其他頁及文件庫原件請自行核對；分享請匯出目前 PDF。');
  }catch(e){tell('redact-message','未完成遮蔽：'+e.message);}finally{lock(false);}
 };
 // Exact-image duplicate warnings: no name-only or visual-similarity claims.
 const originalAdd=add;add=async function(files,options){
  if(busy)return;lock(true);tell('duplicate-message','正在檢查完全相同的原圖…');let accepted=[];
  try{const sizes=new Set(Array.from(files).filter(f=>f.size<=config.maxFileBytes).map(f=>f.size));const known=new Set();for(const p of pages)if(sizes.has(p.file.size))known.add(await T.fileHash(p.file));const stored=await documentLibrary.list().catch(()=>null);if(stored===null)tell('duplicate-message','文件庫暫時無法檢查，未完成跨文件重複檢查');if(stored)for(const r of stored)for(const p of r.pages)if(sizes.has(p.file.size))known.add(await T.fileHash(p.file));
   for(const file of files){if(file.size>config.maxFileBytes){accepted.push(file);continue;}const hash=await T.fileHash(file);if(known.has(hash)&&!confirm(`「${file.name}」的原圖與本次或文件庫圖片完全相同，仍要加入嗎？`))continue;known.add(hash);accepted.push(file);}
  }catch(e){tell('duplicate-message','重複檢查失敗，未匯入：'+e.message);return;}finally{lock(false);}
  await originalAdd(accepted,options);if($('duplicate-message').textContent==='正在檢查完全相同的原圖…')tell('duplicate-message','完全相同原圖檢查完成（未檢查相似照片）');
 };
 const priorSave=$('save-document').onclick;$('save-document').onclick=async()=>{
  if(busy)return;lock(true);
  try{T.receipt(claimSnapshot());const key=await T.documentHash({pages});const matches=[];for(const r of await documentLibrary.list()){if(r.id!==currentDocumentId&&r.pages?.length===pages.length&&r.pages.length&&r.pages.every((p,i)=>p.file.size===pages[i].file.size)&&await T.documentHash(r)===key)matches.push(r.name);}
   if(matches.length&&!confirm(`原圖、頁序及裁切與「${matches.join('、')}」相同，仍要儲存嗎？`)){tell('duplicate-message','已取消重複文件儲存');msg('已取消重複文件儲存');return;}
  }catch(e){tell('duplicate-message','未儲存：'+e.message);msg('未儲存：'+e.message);return;}finally{lock(false);}
  await priorSave();
 };
 const claimIds=['store','tax','payment','reference','note','status'];
 function claimSnapshot(){return {date:$('receipt-date').value,currency:$('receipt-currency').value,amount:$('receipt-amount').value,...Object.fromEntries(claimIds.map(k=>[k,$('claim-'+k).value]))};}
 for(const k of claimIds)$('claim-'+k).addEventListener('input',markDirty);
 const oldSnapshot=productivitySnapshot;productivitySnapshot=function(){const r=oldSnapshot();r.receipt={...r.receipt,...claimSnapshot()};return r;};
 const oldReset=resetProductivity;resetProductivity=function(){oldReset();for(const k of claimIds)$('claim-'+k).value=k==='status'?'draft':'';};
 const oldRestore=restoreProductivity;restoreProductivity=function(record){oldRestore(record);for(const k of claimIds)$('claim-'+k).value=record.receipt?.[k]||(k==='status'?'draft':'');};
 // New claim fields also participate in draft snapshots; recovery's UI list is extended in recovery.js.
 async function claimReport(){const records=await documentLibrary.list(),filter=$('claim-filter').value,selected=records.filter(r=>filter==='all'||(r.receipt?.status||'draft')===filter),report=pro.report(selected,$('expense-from').value,$('expense-to').value,$('expense-tag').value.trim()||'all');
  return{...report,records:report.rows.map(row=>selected.find(r=>r.id===row.id)),rows:report.rows.map(row=>{const r=selected.find(r=>r.id===row.id);return{...row,receipt:r.receipt};})};}
 function reportRows(report){return [['日期','檔名','店家','幣別','總金額','內含稅額','付款方式','狀態','憑證編號','標籤','備註'],...report.rows.map(r=>[r.date,r.name,r.receipt.store||'',r.currency,String(r.amount),r.receipt.tax||'',r.receipt.payment||'',T.statuses[r.receipt.status||'draft']||'草稿',r.receipt.reference||'',r.tags,r.receipt.note||'']),[],['各幣別合計'],...Object.entries(report.totals).map(([c,n])=>['','','',c,n.toFixed(2)])];}
 $('expense-preview').onclick=async()=>{try{const report=await claimReport(),box=$('expense-results');box.replaceChildren();for(const r of report.rows){const line=document.createElement('p');line.textContent=`${r.date} · ${r.receipt.store||r.name} · ${r.currency} ${r.amount.toFixed(2)} · ${T.statuses[r.receipt.status||'draft']||'草稿'}`;box.append(line);}for(const[c,n]of Object.entries(report.totals)){const line=document.createElement('strong');line.textContent=`${c} 合計 ${n.toFixed(2)}`;box.append(line);}tell('expense-message',`${report.rows.length} 筆有效憑證，不同幣別分開合計；未填日期或總金額的文件不列入`);}catch(e){tell('expense-message',e.message);}};
 for(const format of ['csv','xlsx'])$('expense-'+format).onclick=async()=>{try{const r=await claimReport();if(!r.rows.length)throw Error('沒有符合條件的報帳資料');const rows=reportRows(r),blob=format==='csv'?new Blob([advanced.csv(rows)],{type:'text/csv;charset=utf-8'}):new Blob([productivity.zip(advanced.xlsxEntries(rows))],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});downloadBlob(blob,'smartscan-claims.'+format);}catch(e){tell('expense-message',e.message);}};
 $('claim-bundle').onclick=async()=>{if(busy)return;lock(true);try{const r=await claimReport();if(!r.rows.length)throw Error('沒有符合條件的報帳資料');let size=0;for(const record of r.records)for(const p of record.pages){size+=p.file.size;if(size>128*1024*1024)throw Error('憑證原圖超過 128 MiB，請縮小篩選範圍');}
   const entries=[{name:'report.csv',data:new TextEncoder().encode(advanced.csv(reportRows(r)))}],manifest=[];
   for(let i=0;i<r.records.length;i++){const record=r.records[i],files=[];for(let j=0;j<record.pages.length;j++){const p=record.pages[j],ext=p.file.name?.match(/\.(jpe?g|png|webp|gif|bmp|heic|heif|svg|avif|tiff?)$/i)?.[1]||'bin',name=`receipts/${i+1}/page-${j+1}.${ext}`;entries.push({name,data:new Uint8Array(await p.file.arrayBuffer())});files.push(name);}manifest.push({name:record.name,receipt:record.receipt,files});}
   entries.push({name:'manifest.json',data:new TextEncoder().encode(JSON.stringify(manifest,null,2))});downloadBlob(new Blob([productivity.zip(entries)],{type:'application/zip'}),'smartscan-claims.zip');tell('claim-message',`已匯出 ${r.records.length} 份報帳資料與原始憑證；原始憑證可能含敏感資訊，請確認後再分享`);
  }catch(e){tell('claim-message',e.message);}finally{lock(false);}};
})();
