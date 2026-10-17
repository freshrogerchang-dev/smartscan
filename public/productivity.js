"use strict";
const productivity=window.SmartScanProductivity;
let contactTarget=null,mergeCandidate=null,batchCancelled=false,batchBlob=null,translationController=null;
const contactDraft=()=>Object.fromEntries(productivity.fields.map(id=>[id,$(id).value.trim()]));
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=name;
  document.body.append(anchor);try{anchor.click();}finally{anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
}
function resetProductivity(){
  contactTarget=null;batchBlob=null;$("batch-download").hidden=true;$("batch-jobs").replaceChildren();$("batch-message").textContent="";
  for(const id of ["receipt-date","receipt-currency","receipt-amount","translation-original","translation-result"])$(id).value="";
  for(const id of ["receipt-message","translation-message","contact-message"])$(id).textContent="";
}
function productivitySnapshot(){
  return {receipt:{date:$("receipt-date").value,amount:$("receipt-amount").value,currency:$("receipt-currency").value},
    translation:{original:$("translation-original").value,text:$("translation-result").value,source:$("translation-source-language").value,target:$("translation-target-language").value}};
}
function restoreProductivity(record){
  resetProductivity();contactTarget=record.kind==="contact"?record.id:null;
  for(const field of ["date","amount","currency"])$("receipt-"+field).value=record.receipt?.[field]||"";
  const t=record.translation||{};$("translation-original").value=t.original||"";$("translation-result").value=t.text||"";
  $("translation-source-language").value=t.source||"en";$("translation-target-language").value=t.target||"zh-Hant";
}
for(const id of ["receipt-date","receipt-amount","receipt-currency","translation-result","translation-source-language","translation-target-language"])$(id).addEventListener("input",markDirty);
$("receipt-extract").onclick=()=>{
  const text=$("text").value;if(!text.trim())return msg("請先辨識或輸入收據文字");
  const result=productivity.receipt(text);
  $("receipt-date").value=result.date;$("receipt-amount").value=result.amount;$("receipt-currency").value=result.currency;
  $("receipt-message").textContent=`日期 ${result.dates.length} 個候選；總額 ${result.amounts.length} 個候選。`+
    (result.amounts.length?result.amounts.map(item=>item.evidence).join(" ／ "):"找不到含總計標籤的可靠金額，請手動填寫。")+
    (result.dates.length>1?" 日期："+result.dates.join("、"):"");markDirty();
};
$("translation-capture").onclick=()=>{$("translation-original").value=$("text").value;$("translation-result").value="";$("translation-message").textContent="已擷取原文快照，可在右側貼上譯文。";markDirty();};
$("translate-local").onclick=async()=>{
  if(busy)return;const text=$("text").value.trim();if(!text)return msg("請先辨識或輸入文字");
  const options={sourceLanguage:$("translation-source-language").value,targetLanguage:$("translation-target-language").value};
  if(options.sourceLanguage===options.targetLanguage)return $("translation-message").textContent="請選擇不同的原文與譯文語言。";
  if(!window.Translator)return $("translation-message").textContent="此瀏覽器未提供本機翻譯。請改用支援 Translator API 的桌面 Chrome，或擷取原文後自行貼上譯文；未傳送文字。";
  let translator;translationController=new AbortController();const signal=translationController.signal;
  const timeout=setTimeout(()=>translationController?.abort(),120000);lock(true);
  $("translation-cancel").hidden=false;$("translation-cancel").disabled=false;
  try{
    $("translation-message").textContent="準備本機翻譯模型…首次可能需要下載，請保持連網。";
    // create directly from the click to retain user activation for first-use model downloads.
    translator=await window.Translator.create({...options,signal,monitor(m){m.addEventListener("downloadprogress",event=>{$("translation-message").textContent=`下載翻譯模型 ${Math.round(event.loaded*100)}%`;});}});
    const translatedPages=[];
    for(const part of text.split(PAGE_SEPARATOR))translatedPages.push(part.trim()?await translator.translate(part,{signal}):"");
    const translated=translatedPages.join(PAGE_SEPARATOR);
    $("translation-original").value=text;$("translation-result").value=translated;markDirty();
    $("translation-message").textContent="本機翻譯完成。原文保留於左側，請核對譯文；儲存文件可保留此對照。";
  }catch(error){$("translation-message").textContent="本機翻譯未完成："+error.message+"。可自行貼上譯文；原有對照已保留。";}
  finally{clearTimeout(timeout);translationController=null;try{translator?.destroy();}finally{lock(false);$("translation-cancel").hidden=true;updateDocumentControls();}}
};
$("translation-cancel").onclick=()=>translationController?.abort();
$("translation-download").onclick=()=>{
  if(!$("translation-original").value||!$("translation-result").value)return msg("請先補齊原文與譯文");
  downloadBlob(new Blob([`原文（${$("translation-source-language").value}）\n${$("translation-original").value}\n\n譯文（${$("translation-target-language").value}）\n${$("translation-result").value}`],{type:"text/plain;charset=utf-8"}),"smartscan-bilingual.txt");
};
async function saveContact(fields,targetId=null){
  buildVCard(fields);
  const previous=targetId?await documentLibrary.get(targetId):null;
  if(targetId&&(!previous||previous.kind!=="contact"))throw Error("聯絡人已變更，請重新檢查候選");
  const now=Date.now(),record={...previous,id:targetId||crypto.randomUUID(),kind:"contact",name:fields.name||fields.phone||fields.email,category:"card",contact:fields,
    text:productivity.fields.map(id=>fields[id]).join("\n"),pages:[],language:"chi_tra+eng",mode:"card",createdAt:previous?.createdAt||now,updatedAt:now};
  await documentLibrary.put(record);contactTarget=record.id;return record;
}
async function findContacts(duplicatesOnly=false){
  const list=$("contact-list");list.replaceChildren();const draft=contactDraft();
  const records=(await documentLibrary.list()).filter(record=>record.contact&&productivity.fields.some(key=>record.contact[key]?.trim()));
  const matches=records.filter(record=>!duplicatesOnly || (record.id!==contactTarget && productivity.duplicate(draft,record.contact)));
  $("contact-message").textContent=duplicatesOnly?`找到 ${matches.length} 個相同電話／Email 候選；不以姓名自動認定同一人。`:`${records.filter(r=>r.kind==="contact").length} 位本機聯絡人。`;
  for(const record of matches){
    const item=document.createElement("article");item.className="library-item";
    const title=document.createElement("h3");title.textContent=record.contact.name||record.name;
    const detail=document.createElement("p");detail.textContent=[record.contact.company,record.contact.phone,record.contact.email,duplicatesOnly?productivity.duplicate(draft,record.contact):""].filter(Boolean).join(" · ");
    const button=document.createElement("button");button.className="secondary-button";button.textContent=duplicatesOnly?"核對並合併":"載入聯絡人";
    button.onclick=()=>{
      if(busy)return;
      if(duplicatesOnly)openContactMerge(record);
      else{for(const id of productivity.fields)$(id).value=record.contact[id]||"";contactTarget=record.kind==="contact"?record.id:null;updateCardPreview();markDirty();msg("已載入聯絡人草稿");}
    };
    item.append(title,detail,button);list.append(item);
  }
}
$("contact-save").onclick=async()=>{
  if(busy)return;lock(true);
  try{await saveContact(contactDraft(),contactTarget);await findContacts();msg("已儲存本機聯絡人；可下載 vCard 備份");}
  catch(error){msg("聯絡人儲存失敗："+error.message);}finally{lock(false);updateDocumentControls();}
};
$("contact-duplicates").onclick=async()=>{if(busy)return;try{await findContacts(true);}catch(error){msg("檢查失敗："+error.message);}};
$("contact-new").onclick=()=>{if(busy)return;contactTarget=null;for(const id of productivity.fields)$(id).value="";updateCardPreview();markDirty();msg("已開啟新的聯絡人草稿，請填寫欄位");};
function openContactMerge(record){
  mergeCandidate={record,current:contactDraft()};const container=$("contact-merge-fields");container.replaceChildren();
  const labels={name:"姓名",company:"公司",phone:"電話",email:"Email"};
  for(const key of productivity.fields){
    const field=document.createElement("div");field.className="field";
    const label=document.createElement("label");label.htmlFor="merge-"+key;label.textContent=labels[key];
    const select=document.createElement("select");select.id="merge-"+key;
    for(const [value,text] of [["current",mergeCandidate.current[key]],["saved",record.contact[key]]]){
      const option=document.createElement("option");option.value=value;option.textContent=(value==="current"?"目前：":"已存：")+(text||"（空白）");select.append(option);
    }
    select.value=mergeCandidate.current[key]?"current":"saved";field.append(label,select);container.append(field);
  }
  $("contact-merge-dialog").showModal();
}
$("contact-merge-close").onclick=()=>$("contact-merge-dialog").close();
$("contact-merge-apply").onclick=async()=>{
  if(busy||!mergeCandidate)return;lock(true);
  try{
    const {record,current}=mergeCandidate,latest=await documentLibrary.get(record.id);
    if(!latest||latest.updatedAt!==record.updatedAt)throw Error("候選已變更，請關閉後重新檢查");
    const choices=Object.fromEntries(productivity.fields.map(key=>[key,$("merge-"+key).value]));
    const merged=productivity.mergeContact(current,record.contact,choices);
    await saveContact(merged,record.kind==="contact"?record.id:null);
    for(const key of productivity.fields)$(key).value=merged[key];updateCardPreview();markDirty();
    $("contact-merge-dialog").close();await findContacts();msg("已依選定欄位合併聯絡人；掃描原件保留");
  }catch(error){msg("合併失敗："+error.message);}finally{lock(false);updateDocumentControls();}
};
$("contact-qr").onclick=()=>{
  try{
    const text=buildVCard(contactDraft()),bytes=new TextEncoder().encode(text);
    if(bytes.length>1200)throw Error("名片內容過長，請縮短公司／姓名，或改用 vCard 分享");
    const segments=[qrcodegen.QrSegment.makeEci(26),qrcodegen.QrSegment.makeBytes(bytes)];
    const qr=qrcodegen.QrCode.encodeSegments(segments,qrcodegen.QrCode.Ecc.MEDIUM),canvas=$("contact-qr-canvas"),scale=6,border=4;
    canvas.width=canvas.height=(qr.size+border*2)*scale;const context=canvas.getContext("2d");context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle="#000";
    for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.getModule(x,y))context.fillRect((x+border)*scale,(y+border)*scale,scale,scale);
    $("qr-dialog").showModal();
  }catch(error){msg("無法產生 QR："+error.message);}
};
$("qr-close").onclick=()=>$("qr-dialog").close();
$("qr-download").onclick=()=>$("contact-qr-canvas").toBlob(blob=>{if(blob)downloadBlob(blob,"smartscan-contact-qr.png");else msg("QR 圖片匯出失敗");},"image/png");
function exportProfile(){return productivity.profiles[$("export-profile").value]||productivity.profiles.balanced;}
function compressCanvas(canvas){
  const {edge}=exportProfile(),scale=Math.min(1,edge/Math.max(canvas.width,canvas.height));if(scale===1)return canvas;
  const result=document.createElement("canvas");result.width=Math.max(1,Math.round(canvas.width*scale));result.height=Math.max(1,Math.round(canvas.height*scale));result.getContext("2d").drawImage(canvas,0,0,result.width,result.height);return result;
}
$("batch-cancel").onclick=()=>{batchCancelled=true;$("batch-cancel").disabled=true;$("batch-message").textContent="將在目前頁面完成後停止。";};
$("batch-start").onclick=async()=>{
  if(busy)return;if(!pages.length)return msg("請先匯入要批次處理的圖片");
  try{if($("text").value.trim())syncEditor();}catch(error){return msg(error.message);}
  batchCancelled=false;batchBlob=null;$("batch-download").hidden=true;$("batch-jobs").replaceChildren();lock(true);
  $("batch-cancel").hidden=false;$("batch-cancel").disabled=false;
  const entries=[],report={profile:$("export-profile").value,pages:[]};let succeeded=0,inputBytes=0,outputBytes=0;
  try{
    for(let i=0;i<pages.length;i++){
      const item=document.createElement("li");$("batch-jobs").append(item);
      if(batchCancelled){item.textContent=`第 ${i+1} 頁 · 已取消`;report.pages.push({page:i+1,status:"cancelled"});continue;}
      item.textContent=`第 ${i+1} 頁 · 處理中`;
      try{
        const canvas=compressCanvas(await pageCanvas(pages[i])),blob=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(Error("圖片編碼失敗")),"image/jpeg",exportProfile().quality));
        const name=`page-${String(i+1).padStart(2,"0")}.jpg`;
        entries.push({name,data:new Uint8Array(await blob.arrayBuffer())});
        if(pages[i].text?.trim())entries.push({name:name.replace(".jpg",".txt"),data:new TextEncoder().encode(pages[i].text)});
        inputBytes+=pages[i].file.size;outputBytes+=blob.size;succeeded++;
        item.textContent=`第 ${i+1} 頁 · 完成 · ${Math.round(blob.size/1024)} KB`;
        report.pages.push({page:i+1,status:"completed",name,width:canvas.width,height:canvas.height,inputBytes:pages[i].file.size,outputBytes:blob.size});
      }catch(error){item.textContent=`第 ${i+1} 頁 · 失敗：${error.message}`;report.pages.push({page:i+1,status:"failed",error:error.message});}
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(succeeded){entries.push({name:"manifest.json",data:new TextEncoder().encode(JSON.stringify(report,null,2))});batchBlob=productivity.zip(entries);}
    $("batch-message").textContent=`完成 ${succeeded}/${pages.length} 頁；原檔 ${(inputBytes/1024).toFixed(0)} KB → JPEG ${(outputBytes/1024).toFixed(0)} KB（ZIP 另含文字及紀錄）。失敗／取消頁未包含，可重新執行。`;
    msg(batchCancelled?"批次已停止，可下載已完成頁面":"批次完成，請檢查每頁結果");
  }catch(error){$("batch-message").textContent="批次失敗："+error.message;}
  finally{lock(false);$("batch-cancel").hidden=true;$("batch-download").hidden=!batchBlob;updateDocumentControls();}
};
$("batch-download").onclick=()=>{if(batchBlob)downloadBlob(batchBlob,"smartscan-batch.zip");};
// Contact drafts are also available when there are no scanned pages.
const originalShowView=showView;
showView=function(view,focusTab=false){originalShowView(view,focusTab);if(view==="card"&&!busy)findContacts().catch(error=>{$("contact-message").textContent=error.message;});};
