"use strict";
const tools = window.SmartScanTools;
const documentLibrary = new window.SmartScanLibrary();
let currentDocumentId = null, sessionDirty = false, libraryGeneration = 0, fontPromise = null, categoryEdited = false;
const PAGE_SEPARATOR = "\n\n--- 下一頁 ---\n\n";
function markDirty() { sessionDirty = true; }
function resetDocument() {
  currentDocumentId = null; sessionDirty = false; categoryEdited = false;
  $("document-name").value = ""; $("document-category").value = "document";
  $("text").value = ""; $("searchable-pdf").checked = false;
  for(const id of ["name","company","phone","email"])$(id).value="";
  updateCardPreview();
  if(typeof resetProductivity === "function")resetProductivity();
  if(typeof resetAdvanced === "function")resetAdvanced();
}
function updateDocumentControls() { $("save-document").disabled = busy || !pages.length; }
function suggestDocument(force = true) {
  const suggestion = tools.suggest($("text").value.split(PAGE_SEPARATOR).join("\n"), pages[0]?.file.name, $("mode").value);
  if (force || !$("document-name").value.trim()) $("document-name").value = suggestion.name;
  if (force || !categoryEdited) $("document-category").value = suggestion.category;
}
function syncEditor() {
  const parts = $("text").value.split(PAGE_SEPARATOR);
  if (parts.length !== pages.length) throw Error("多頁文字分隔已變更，請保留「--- 下一頁 ---」分隔或重新辨識");
  parts.forEach((text, i) => {
    if ((pages[i].text || "").trim() !== text.trim()) { pages[i].words = []; pages[i].text = text.trim(); }
  });
}
function refreshEditor() { $("text").value=pages.map(page=>page.text || "").join(PAGE_SEPARATOR); }
async function updatePageThumbnail(image,page) {
  try {
    const canvas=await pageCanvas(page),thumb=document.createElement("canvas"),scale=Math.min(1,320/Math.max(canvas.width,canvas.height));
    thumb.width=Math.max(1,Math.round(canvas.width*scale));thumb.height=Math.max(1,Math.round(canvas.height*scale));
    thumb.getContext("2d").drawImage(canvas,0,0,thumb.width,thumb.height);
    if(image.isConnected){image.src=thumb.toDataURL("image/jpeg",.8);image.style.transform="none";}
  }catch(error){image.alt="裁切預覽暫不可用；原圖仍保留";}
}
function invalidatePage(page) {
  page.text = ""; page.words = []; page.ocrKey = null;
  $("text").value = pages.map(p => p.text || "").join(PAGE_SEPARATOR);
  $("searchable-pdf").checked = false;
  markDirty();
}
$("text").oninput = () => { markDirty(); };
for(const id of ["name","company","phone","email"])$(id).oninput=()=>{updateCardPreview();markDirty();};
$("document-name").oninput = markDirty;
$("document-category").onchange = () => {categoryEdited=true;markDirty();};
$("suggest-name").onclick = () => { suggestDocument(); markDirty(); msg("已建議檔名與分類，儲存前可自行調整"); };
$("save-document").onclick = async () => {
  if (busy || !pages.length) return;
  lock(true);
  try {
    if ($("text").value.trim()) syncEditor();
    if (!$("document-name").value.trim()) suggestDocument(false);
    const id = currentDocumentId || crypto.randomUUID(), previous = currentDocumentId ? await documentLibrary.get(id) : null;
    const record = {
      id, name: tools.safeName($("document-name").value), category: $("document-category").value,
      text: $("text").value, createdAt: previous?.createdAt || Date.now(), updatedAt: Date.now(),
      language: $("language").value, mode: $("mode").value,
      contact: Object.fromEntries(["name","company","phone","email"].map(id=>[id,$(id).value])),
      pages: pages.map(({ file, rotation, crop, text, words, ocrWidth, ocrHeight, ocrKey }) => ({ file, rotation, crop, text, words, ocrWidth, ocrHeight, ocrKey }))
    };
    if(typeof productivitySnapshot === "function")Object.assign(record,productivitySnapshot());
    if(typeof advancedSnapshot === "function")record.advanced=advancedSnapshot();
    await documentLibrary.put(record);
    currentDocumentId = id; sessionDirty = false;
    msg("已儲存到這個瀏覽器的文件庫；請另下載 PDF 作備份");
  } catch (error) { msg("儲存失敗：" + error.message); }
  finally { lock(false); updateDocumentControls(); }
};
async function renderLibrary() {
  const generation = ++libraryGeneration;
  const list = $("library-list");
  $("library-message").textContent = "正在讀取本機文件…";
  try {
    const records = await documentLibrary.list();
    if (generation !== libraryGeneration) return;
    const query = $("library-query").value, category = $("library-category").value;
    const matches = records.filter(record => tools.matches(record, query, category)).sort((a,b) => b.updatedAt-a.updatedAt);
    list.replaceChildren();
    $("library-message").textContent = records.length ? `${matches.length} / ${records.length} 份文件；搜尋檔名、分類與已儲存文字` : "還沒有文件。先掃描，再按「儲存到文件庫」。";
    for (const record of matches) {
      const item = document.createElement("article"); item.className = "library-item";
      const badge = document.createElement("span"); badge.className = "library-category"; badge.textContent = tools.categories[record.category] || "文件";
      const title = document.createElement("h2"); title.textContent = record.name;
      const hasText=record.text.split(PAGE_SEPARATOR).some(text=>text.trim());
      const detail = document.createElement("p"); detail.textContent = `${record.kind==="contact"?"聯絡人":record.pages.length+" 頁"} · ${new Date(record.updatedAt).toLocaleDateString()} · ${hasText ? "可搜尋文字" : "尚未辨識"}`;
      const snippet = document.createElement("p"); snippet.className = "library-snippet";
      const at = tools.searchText(record.text).indexOf(tools.searchText(query));
      snippet.textContent = record.text.replace(/\s+/g," ").slice(Math.max(0,at-25),Math.max(0,at-25)+160) || "可開啟後辨識文字，讓這份文件能被搜尋。";
      const actions = document.createElement("div"); actions.className = "library-item-actions";
      const open = document.createElement("button"); open.className = "secondary-button"; open.textContent = "開啟文件"; open.onclick = () => openDocument(record.id);
      const remove = document.createElement("button"); remove.className = "text-button"; remove.textContent = "刪除";
      remove.onclick = async () => {
        if (busy || !window.confirm(`確定從本機文件庫刪除「${record.name}」？此動作無法復原，請先下載備份。`)) return;
        try { await documentLibrary.remove(record.id); if(currentDocumentId===record.id){currentDocumentId=null;markDirty();} await renderLibrary(); msg("已刪除本機文件"); }
        catch(error){msg("刪除失敗："+error.message);}
      };
      actions.append(open, remove); item.append(badge,title,detail,snippet,actions); list.append(item);
    }
  } catch (error) { $("library-message").textContent = "無法讀取文件庫：" + error.message; }
}
async function openDocument(id) {
  if (busy) return;
  if (pages.length && sessionDirty && !window.confirm("目前掃描尚有未儲存變更。要捨棄變更並開啟文件嗎？")) return;
  lock(true);
  try {
    const record = await documentLibrary.get(id);
    if (!record) throw Error("找不到這份文件，請重新整理文件庫");
    const restored = record.pages.map(page => ({ ...page, url: URL.createObjectURL(page.file) }));
    pages.forEach(page => URL.revokeObjectURL(page.url)); pages = restored;
    currentDocumentId = record.id; sessionDirty = false; categoryEdited = true;
    $("document-name").value = record.name; $("document-category").value = record.category;
    $("language").value = record.language; $("mode").value = record.mode;
    $("text").value = record.text;
    for(const id of ["name","company","phone","email"])$(id).value=record.contact?.[id] || "";
    updateCardPreview();
    if(typeof restoreProductivity === "function")restoreProductivity(record);
    if(typeof restoreAdvanced === "function")restoreAdvanced(record);
    $("searchable-pdf").checked = pages.every(page=>page.text?.trim());
    lock(false); render(); showView(record.kind==="contact"?"card":"scan"); msg("已開啟本機文件，可編輯或重新匯出");
  } catch (error) { msg("開啟失敗：" + error.message); }
  finally { lock(false); updateDocumentControls(); }
}
$("library-query").oninput = renderLibrary;
$("library-category").onchange = renderLibrary;
async function loadPdfFont() {
  if (!fontPromise) fontPromise = (async () => {
    const response = await fetch("/fonts/SmartScanCJK.ttf");
    if (!response.ok) throw Error("無法載入搜尋字型，請連網後重試，或取消可搜尋 PDF 選項");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let i=0;i<bytes.length;i+=32768) binary += String.fromCharCode(...bytes.subarray(i,i+32768));
    return btoa(binary);
  })().catch(error=>{fontPromise=null;throw error;});
  return fontPromise;
}
$("pdf").onclick = async () => {
  if (busy || !pages.length) return;
  lock(true);
  try {
    if (!window.jspdf) throw Error("PDF 程式尚未下載，請連網後重試");
    const searchable = $("searchable-pdf").checked;
    if (searchable) {
      syncEditor();
      if (pages.some(page=>!page.text?.trim())) throw Error("請先辨識或補齊每頁文字，再匯出可搜尋 PDF；也可取消文字層選項");
    }
    if (!$("document-name").value.trim()) suggestDocument(false);
    const pdf = new window.jspdf.jsPDF({unit:"mm",format:"a4",putOnlyUsedFonts:true});
    if (searchable) {
      msg("準備搜尋文字層…首次需載入約 12 MB 字型");
      pdf.addFileToVFS("SmartScanCJK.ttf", await loadPdfFont());
      pdf.addFont("SmartScanCJK.ttf","SmartScanCJK","normal");
      pdf.setFont("SmartScanCJK","normal");
    }
    for(let i=0;i<pages.length;i++) {
      msg(`建立 PDF ${i+1}/${pages.length}`); if(i)pdf.addPage();
      const page=pages[i],canvas=await pageCanvas(page),fit=Math.min(210/canvas.width,297/canvas.height);
      const width=canvas.width*fit,height=canvas.height*fit,x=(210-width)/2,y=(297-height)/2;
      const image=typeof compressCanvas === "function"?compressCanvas(canvas):canvas;
      const quality=typeof exportProfile === "function"?exportProfile().quality:.85;
      pdf.addImage(image.toDataURL("image/jpeg",quality),"JPEG",x,y,width,height);
      if(searchable) {
        const validWords=page.words?.length && !/[\u2e80-\u9fff\u3040-\u30ff]/.test(page.text) && page.ocrKey===JSON.stringify([page.rotation,page.crop || null]) && page.ocrWidth===canvas.width && page.ocrHeight===canvas.height;
        if(validWords) {
          for(const word of page.words) {
            if(!word.text?.trim() || !word.bbox)continue;
            const b=word.bbox;pdf.setFontSize(Math.max(1,(b.y1-b.y0)*fit*72/25.4*.85));
            pdf.text(word.text,x+b.x0*fit,y+b.y1*fit,{renderingMode:"invisible"});
          }
        } else {
          const normalizedText=tools.pdfText(page.text);
          pdf.setFontSize(10);let lines=pdf.splitTextToSize(normalizedText,190);
          const size=Math.max(1,Math.min(10,265/(Math.max(1,lines.length)*.4)));pdf.setFontSize(size);
          lines=pdf.splitTextToSize(normalizedText,190);pdf.text(lines,10,12,{renderingMode:"invisible",lineHeightFactor:1.1});
        }
      }
    }
    pdf.save(tools.safeName($("document-name").value.replace(/\.pdf$/i,""))+".pdf");
    msg(searchable ? "已建立可搜尋 PDF；搜尋文字取決於辨識與核對結果" : "已建立圖片 PDF");
  } catch(error) {msg("PDF 失敗："+error.message);}
  finally {lock(false);updateDocumentControls();}
};
let cropPage = null, cropImage = null, cropBounds = null, cropStart = null;
function readCropFields() {
  const [left,top,right,bottom] = ["crop-left","crop-top","crop-right","crop-bottom"].map(id=>Number($(id).value)/100);
  if([left,top,right,bottom].some(x=>!Number.isFinite(x)||x<0||x>1)||right-left<.01||bottom-top<.01)throw Error("請保留至少 1% 的有效裁切範圍");
  return {x:left,y:top,width:right-left,height:bottom-top};
}
function writeCropFields() {
  const b=cropBounds;
  for(const [id,value] of [["crop-left",b.x],["crop-top",b.y],["crop-right",b.x+b.width],["crop-bottom",b.y+b.height]]) $(id).value=(value*100).toFixed(1);
}
function drawCrop() {
  if(!cropImage||!cropBounds)return;
  const canvas=$("crop-preview"),ctx=canvas.getContext("2d");
  ctx.drawImage(cropImage,0,0,canvas.width,canvas.height);
  const x=cropBounds.x*canvas.width,y=cropBounds.y*canvas.height,w=cropBounds.width*canvas.width,h=cropBounds.height*canvas.height;
  ctx.fillStyle="rgba(10,32,24,.5)";
  ctx.fillRect(0,0,canvas.width,y);ctx.fillRect(0,y+h,canvas.width,canvas.height-y-h);ctx.fillRect(0,y,x,h);ctx.fillRect(x+w,y,canvas.width-x-w,h);
  ctx.strokeStyle="#b8e7aa";ctx.lineWidth=3;ctx.strokeRect(x,y,w,h);
}
function detectCrop() {
  const canvas=$("crop-preview"),ctx=canvas.getContext("2d");ctx.drawImage(cropImage,0,0,canvas.width,canvas.height);
  const candidate=tools.detectBounds(ctx.getImageData(0,0,canvas.width,canvas.height));
  cropBounds=candidate || {x:0,y:0,width:1,height:1};writeCropFields();drawCrop();
  $("crop-message").textContent=candidate ? "已建議裁切範圍，請確認沒有裁掉內容再套用。" : "未找到可靠邊界，已保留原圖。可拖曳框選或調整百分比。";
}
async function openCrop(page) {
  if(busy)return;
  try {
    cropPage=page;cropImage=await load(page.url);const canvas=$("crop-preview"),scale=Math.min(1,640/Math.max(cropImage.naturalWidth,cropImage.naturalHeight));
    canvas.width=Math.max(1,Math.round(cropImage.naturalWidth*scale));canvas.height=Math.max(1,Math.round(cropImage.naturalHeight*scale));
    $("crop-dialog").showModal();
    if(page.crop){cropBounds={...page.crop};writeCropFields();drawCrop();$("crop-message").textContent="調整裁切範圍，原始圖片仍會保留。";}else detectCrop();
  }catch(error){msg("無法裁切："+error.message);}
}
$("crop-auto").onclick=detectCrop;
$("crop-reset").onclick=()=>{cropBounds={x:0,y:0,width:1,height:1};writeCropFields();drawCrop();$("crop-message").textContent="已還原完整圖片，按套用確認。";};
$("crop-close").onclick=()=>$("crop-dialog").close();
$("crop-apply").onclick=()=>{
  try {
    const bounds=readCropFields();cropPage.crop=bounds.width>=.999&&bounds.height>=.999?null:bounds;
    invalidatePage(cropPage);$("crop-dialog").close();render();msg("已套用裁切；原圖保留，可還原。請重新辨識這一頁文字。");
  }catch(error){$("crop-message").textContent=error.message;}
};
for(const id of ["crop-left","crop-top","crop-right","crop-bottom"])$(id).oninput=()=>{try{cropBounds=readCropFields();drawCrop();}catch(error){$("crop-message").textContent=error.message;}};
const cropCanvas=$("crop-preview");
const point=event=>{const rect=cropCanvas.getBoundingClientRect();return {x:Math.min(1,Math.max(0,(event.clientX-rect.left)/rect.width)),y:Math.min(1,Math.max(0,(event.clientY-rect.top)/rect.height))};};
cropCanvas.onpointerdown=event=>{cropStart=point(event);cropCanvas.setPointerCapture(event.pointerId);};
cropCanvas.onpointermove=event=>{
  if(!cropStart)return;const end=point(event);
  cropBounds={x:Math.min(cropStart.x,end.x),y:Math.min(cropStart.y,end.y),width:Math.max(.01,Math.abs(end.x-cropStart.x)),height:Math.max(.01,Math.abs(end.y-cropStart.y))};
  writeCropFields();drawCrop();
};
cropCanvas.onpointerup=cropCanvas.onpointercancel=()=>{cropStart=null;};
render();
