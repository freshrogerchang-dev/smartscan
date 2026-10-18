"use strict";
(function(){
 const helper=window.SmartScanRecoveryTools,tabId='draft-'+crypto.randomUUID();
 const uiIds=['document-name','document-category','document-tags','name-template','searchable-pdf','language','mode','text','name','company','phone','email','receipt-date','receipt-currency','receipt-amount','translation-original','translation-result','translation-source-language','translation-target-language','event-title','event-zone','event-start','event-end','event-location','event-description','event-all-day','table-source','table-page','table-mode','table-input','ai-question','ai-result','ai-source','ai-language','vision-result','vision-mode','vision-page','export-profile'];
 let ready=false,timer=null,saving=Promise.resolve(),lastSignature='',recoveryItems=[],pendingBackup=null,restoring=false,failed=false;
 const note=text=>{$('draft-status').textContent=text;$('draft-summary').textContent=text;};
 function uiSnapshot(){return Object.fromEntries(uiIds.filter(id=>$(id)).map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]));}
 function snapshot(){
  const ui=uiSnapshot();
  const record={id:currentDocumentId||tabId,name:$('document-name').value||'未命名草稿',category:$('document-category').value,text:$('text').value,createdAt:Date.now(),updatedAt:Date.now(),language:$('language').value,mode:$('mode').value,contact:Object.fromEntries(['name','company','phone','email'].map(id=>[id,$(id).value])),pages:pages.map(({url,...page})=>page)};
  if(typeof productivitySnapshot==='function')Object.assign(record,productivitySnapshot());
  if(typeof advancedSnapshot==='function')record.advanced=advancedSnapshot();
  record.tags=pro.tags($('document-tags').value);
  return {id:tabId,updatedAt:Date.now(),documentId:currentDocumentId,record,ui};
 }
 const fileIds=new WeakMap();let fileSeq=0;
 function signature(d){return JSON.stringify({documentId:d.documentId,ui:d.ui,record:{...d.record,createdAt:0,updatedAt:0,pages:d.record.pages.map(p=>{if(!fileIds.has(p.file))fileIds.set(p.file,++fileSeq);return{...p,file:fileIds.get(p.file)};})}});}
 function hasContent(d){return d.record.pages.length||['document-name','document-tags','text','name','company','phone','email','translation-original','translation-result','ai-question','ai-result','ai-source','vision-result','table-source','event-title','event-start','event-end','event-location','event-description','receipt-date','receipt-amount'].some(id=>String(d.ui[id]||'').trim());}
 async function persist(){
  if(!ready||busy||restoring)return;
  const draft=snapshot(),sig=signature(draft);if(sig===lastSignature)return;
  note('正在儲存草稿…');
  const task=async()=>{
   try{if(hasContent(draft))await documentLibrary.saveDraft(draft);else await documentLibrary.removeDraft(tabId);lastSignature=sig;failed=false;note(hasContent(draft)?'草稿已儲存於此裝置 · '+new Date().toLocaleTimeString():'尚無草稿');}
   catch(error){failed=true;$('recovery-panel').open=true;note('草稿未儲存：'+error.message+'。請保留此頁並下載備份。');throw error;}
  };
  saving=saving.catch(()=>{}).then(task);return saving;
 }
 function schedule(){if(!ready)return;clearTimeout(timer);timer=setTimeout(()=>persist().catch(()=>{}),650);}
 async function refreshDrafts(){
  recoveryItems=(await documentLibrary.drafts()).filter(d=>d.id!==tabId).sort((a,b)=>b.updatedAt-a.updatedAt);
  const select=$('draft-select');select.replaceChildren();
  for(const d of recoveryItems){const option=document.createElement('option');option.value=d.id;option.textContent=`${d.record.name} · ${d.record.pages.length} 頁 · ${new Date(d.updatedAt).toLocaleString()}`;select.append(option);}
  $('draft-recover').hidden=!recoveryItems.length;$('draft-empty').hidden=!!recoveryItems.length;if(recoveryItems.length)$('recovery-panel').open=true;
 }
 async function restoreDraft(){
  if(busy||restoring)return;
  const selected=recoveryItems.find(d=>d.id===$('draft-select').value);if(!selected)return;
  await persist();await saving;
  if(hasContent(snapshot())&&!window.confirm('恢復另一份草稿？目前內容會先保留為另一份草稿。'))return;
  // Preserve the current tab's snapshot under an independent ID before replacing it.
  const previous=snapshot();if(hasContent(previous))await documentLibrary.saveDraft({...previous,id:'draft-'+crypto.randomUUID()});
  restoring=true;let urls=[];
  try{
   const next=selected.record.pages.map(p=>{const url=URL.createObjectURL(p.file);urls.push(url);return{...p,url};});
   pages.forEach(p=>URL.revokeObjectURL(p.url));pages=next;currentDocumentId=selected.documentId||null;sessionDirty=true;categoryEdited=true;
   if(typeof restoreProductivity==='function')restoreProductivity(selected.record);
   if(typeof restoreAdvanced==='function')restoreAdvanced(selected.record);
   for(const id of uiIds){if(!$(id)||!Object.hasOwn(selected.ui,id))continue;if($(id).type==='checkbox')$(id).checked=!!selected.ui[id];else $(id).value=String(selected.ui[id]);}
   updateCardPreview();render();showView('scan');lastSignature='';
  }catch(error){urls.forEach(u=>URL.revokeObjectURL(u));throw error;}
  finally{restoring=false;}
  await persist();await saving;
  // Keep the source draft: another open tab may still own it.
  await refreshDrafts();msg('已恢復草稿，包含原圖、頁序、裁切與編輯內容');
 }
 $('draft-restore').onclick=()=>restoreDraft().catch(e=>note('恢復失敗：'+e.message));
 $('draft-delete').onclick=async()=>{const id=$('draft-select').value;if(!id||!confirm('只刪除選取的恢復草稿？不會刪除文件庫。其他分頁若仍開啟，可能再儲存此草稿。'))return;try{await documentLibrary.removeDraft(id);await refreshDrafts();}catch(e){note(e.message);}};
 $('draft-refresh').onclick=()=>refreshDrafts().catch(e=>note(e.message));
 $('draft-save').onclick=()=>persist().catch(()=>{});
 document.addEventListener('input',schedule);document.addEventListener('change',schedule);document.addEventListener('click',()=>queueMicrotask(schedule));
 const oldDirty=markDirty;markDirty=function(){oldDirty();schedule();};
 const oldRender=render;render=function(){const result=oldRender();schedule();return result;};
 const oldLock=lock;lock=function(value){oldLock(value);if(!value)schedule();};
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persist().catch(()=>{});});
 window.addEventListener('pagehide',()=>{persist().catch(()=>{});});
 window.addEventListener('beforeunload',e=>{if(ready&&(busy||failed||signature(snapshot())!==lastSignature)){e.preventDefault();e.returnValue='';}});
 setInterval(()=>{if(document.visibilityState==='visible')persist().catch(()=>{});},5000);
 async function exportBackup(){
  if(busy)return;await persist();await saving;lock(true);
  try{
   $('backup-message').textContent='正在整理原圖、文件與草稿…';
   const stored=await documentLibrary.backupSnapshot();
   const blob=await helper.encode({...stored,settings:{'name-template':$('name-template').value}});
   downloadBlob(blob,'smartscan-backup-'+new Date().toISOString().slice(0,10)+'.smartscan.json');
   $('backup-message').textContent='完整備份已產生，請確認下載完成。含原圖、辨識文字、分類標籤、本機聯絡人及草稿；不含登入授權。';
  }catch(e){$('backup-message').textContent='備份失敗：'+e.message;}
  finally{lock(false);}
 }
 $('backup-export').onclick=()=>exportBackup().catch(e=>$('backup-message').textContent=e.message);
 $('backup-file').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file||busy)return;pendingBackup=null;$('backup-confirm').hidden=true;lock(true);
  try{pendingBackup=await helper.decode(file);$('backup-message').textContent=`檢查通過：${pendingBackup.documents.length} 份文件／聯絡人、${pendingBackup.drafts.length} 份草稿。按確認後新增為副本，保留原有文件。可在上方恢復匯入的草稿。`;$('backup-confirm').hidden=false;}
  catch(error){$('backup-message').textContent='無法還原：'+error.message;}
  finally{lock(false);}
 };
 $('backup-confirm').onclick=async()=>{
  if(busy||!pendingBackup)return;
  const data=pendingBackup;lock(true);
  try{
   const ids=new Map(data.documents.map(r=>[r.id,crypto.randomUUID()]));
   const documents=data.documents.map(r=>{const copy={...r,id:ids.get(r.id),syncRevision:crypto.randomUUID(),name:tools.safeName(r.name+'_還原副本')};return copy;});
   const drafts=data.drafts.map(d=>({...d,id:'import-'+crypto.randomUUID(),documentId:ids.get(d.documentId)||null,record:{...d.record,id:ids.get(d.record.id)||crypto.randomUUID(),syncRevision:crypto.randomUUID()}}));
   await documentLibrary.importBackup(documents,drafts);
   pendingBackup=null;$('backup-confirm').hidden=true;
   $('backup-message').textContent=`還原完成：新增 ${documents.length} 份文件／聯絡人、${drafts.length} 份草稿。原有資料與目前工作區皆保留。`;
   $('backup-template').value=data.settings['name-template']||'';$('backup-template-apply').hidden=!$('backup-template').value;
   await renderLibrary();await refreshDrafts();
  }catch(error){$('backup-message').textContent='還原未完成：'+error.message+'。原有資料保留，可重試。';}
  finally{lock(false);}
 };
 $('backup-template-apply').onclick=()=>{try{saveSetting('name-template',$('backup-template').value);$('name-template').value=$('backup-template').value;$('backup-template-apply').hidden=true;$('backup-message').textContent='已套用備份中的檔名範本';}catch(e){$('backup-message').textContent=e.message;}};
 documentLibrary.open().then(async()=>{await refreshDrafts();ready=true;lastSignature=signature(snapshot());note(recoveryItems.length?'找到 '+recoveryItems.length+' 份可恢復草稿，請選擇後恢復。':'草稿會自動儲存於此裝置');}).catch(e=>note('草稿恢復不可用：'+e.message));
})();
