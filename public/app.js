"use strict";
const $ = id => document.getElementById(id);
const config = window.SMARTSCAN_CONFIG;
let pages = [], busy = false, lockedControls = new Map();
const msg = text => $("status").textContent = text;
function setWorkProgress(value,stage,detail="") { window.SmartScanProgress?.update(value,stage,detail); }
function lock(value) {
  const previousBusy=busy;
  busy = value;
  const indicator = $("busy-indicator");
  if (indicator) indicator.classList.toggle("is-busy", value);
  if (value) {
    lockedControls = new Map();
    for (const el of document.querySelectorAll('button,input,select,textarea')) {
      lockedControls.set(el, el.disabled);
      el.disabled = true;
    }
  } else {
    for (const [el, disabled] of lockedControls) el.disabled = disabled;
    lockedControls.clear();
  }
  $("pdf").disabled = $("ocr").disabled = value || !pages.length;
  if(value&&!previousBusy)window.SmartScanProgress?.start();
  if(!value&&previousBusy)window.SmartScanProgress?.end($("status").textContent);
}
function render() {
  const el = $("pages");
  el.replaceChildren();
  pages.forEach((page, i) => {
    const fig = document.createElement("figure"), image = document.createElement("img"), cap = document.createElement("figcaption");
    image.src = page.url;
    if((page.crop||page.perspective) && typeof updatePageThumbnail === "function")updatePageThumbnail(image,page);
    image.style.transform = `rotate(${page.rotation}deg)`;
    image.alt = `第 ${i + 1} 頁預覽`;
    cap.textContent = `第 ${i + 1} 頁${page.autoCropState === "applied" ? " · 已自動裁切，可調整" : page.autoCropState === "uncertain" ? " · 未確認邊界，保留原圖" : ""}`;
    fig.append(image, cap);
    const actions = [
      ["前移", () => { [pages[i - 1], pages[i]] = [pages[i], pages[i - 1]]; }, i === 0],
      ["後移", () => { [pages[i + 1], pages[i]] = [pages[i], pages[i + 1]]; }, i === pages.length - 1],
      ["旋轉", () => { page.rotation = (page.rotation + 90) % 360; if(typeof invalidatePage === "function")invalidatePage(page); }, false],
      ["刪除", () => { URL.revokeObjectURL(page.url); pages.splice(i, 1); }, false]
    ];
    for (const [label, action, disabled] of actions) {
      const button = document.createElement("button");
      button.textContent = label;
      button.setAttribute("aria-label", `第 ${i + 1} 頁${label}`);
      button.disabled = busy || disabled;
      button.onclick = () => {
        if(busy || disabled)return;
        try {
          if($("text").value.trim() && typeof syncEditor === "function")syncEditor();
          action();
          if(typeof refreshEditor === "function")refreshEditor();
          if(typeof markDirty === "function")markDirty();render();
        }catch(error){msg(error.message);}
      };
      fig.append(button);
    }
    if(typeof openCrop === "function") {
      const cropButton=document.createElement("button");cropButton.textContent=page.crop?"調整裁切":"自動裁切";
      cropButton.setAttribute("aria-label",`第 ${i+1} 頁裁切`);cropButton.onclick=()=>openCrop(page);fig.append(cropButton);
    }
    if(typeof openPerspective==="function"){const button=document.createElement("button");button.textContent="四角校正";button.setAttribute("aria-label",`第 ${i+1} 頁四角校正`);button.onclick=()=>openPerspective(page);fig.append(button);}
    el.append(fig);
  });
  $("pdf").disabled = $("ocr").disabled = busy || !pages.length;
  const emptyState = $("empty-state"), count = $("page-count");
  if (emptyState) emptyState.hidden = pages.length > 0;
  if (count) count.textContent = String(pages.length).padStart(2, "0");
  if(typeof updateDocumentControls === "function")updateDocumentControls();
  msg(`${pages.length} 頁`);
}
const load = url => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(Error("無法解碼圖片；HEIC 請改用支援的 Safari，或先轉為 JPEG／PNG"));
  image.src = url;
});
async function add(files, options = {}) {
  if (busy) return;
  try {if(pages.length && $("text").value.trim() && typeof syncEditor === "function")syncEditor();}
  catch(error){msg(error.message);return;}
  lock(true);
  const failures = [];
  let processed=0;
  setWorkProgress(0,"讀取圖片",`0 / ${files.length} 張`);
  try {
    for (const file of files) {
      let url;
      try {
        if (!(file.type.startsWith("image/") || (!file.type && /\.(jpe?g|png|webp|gif|bmp|tiff?|heic|heif|avif|svg)$/i.test(file.name)))) throw Error("不是支援的圖片類型");
        if (file.size > config.maxFileBytes) throw Error("超過單張 20 MiB 限制");
        if (pages.length >= config.maxPages) throw Error("最多匯入 20 頁");
        if (pages.reduce((n, p) => n + p.file.size, 0) + file.size > config.maxTotalBytes) throw Error("超過總檔案 80 MiB 限制");
        url = URL.createObjectURL(file);
        msg(`檢查圖片：${file.name}`);
        const image = await load(url);
        if (!(image.naturalWidth||image.width) || !(image.naturalHeight||image.height) || (image.naturalWidth||image.width) * (image.naturalHeight||image.height) > config.maxImagePixels) throw Error("圖片尺寸無效或超過 32 百萬像素，請先縮小圖片");
        let crop=null,autoCropState=null;
        if(options.autoCrop && typeof automaticCameraCrop === "function") {
          msg("偵測文件邊界…");
          try {crop=automaticCameraCrop(image);autoCropState=crop?"applied":"uncertain";}catch{autoCropState="uncertain";}
        }
        pages.push({ file, url, rotation: 0, crop, autoCropState, text: "", words: [] });
        if(typeof markDirty === "function")markDirty();
      } catch (error) {
        if (url) URL.revokeObjectURL(url);
        failures.push(`${file.name}：${error.message}`);
      } finally {
        processed++;setWorkProgress(processed/files.length*100,"讀取圖片",`${processed} / ${files.length} 張已檢查`);
      }
    }
  } finally {
    lock(false);
    if(typeof refreshEditor === "function")refreshEditor();
    render();
    if (failures.length) msg(`${pages.length} 頁；未匯入 ${failures.length} 張。${failures.join("；")}`);
  }
}
for (const id of ["camera", "upload"]) $(id).onchange = async event => {
  const files = Array.from(event.target.files);
  event.target.value = "";
  await add(files, {autoCrop:id === "camera" && $("camera-auto-crop")?.checked !== false});
};
$("clear").onclick = () => {
  if (busy) return;
  pages.forEach(page => URL.revokeObjectURL(page.url));
  pages = [];
  if(typeof resetDocument === "function")resetDocument();
  render();
};
async function pageCanvas(page) {
  let image = await load(page.url);
  if(page.perspective&&typeof perspectiveCanvas==="function")image=perspectiveCanvas(image,page.perspective);
  const canvas = document.createElement("canvas");
  const crop=page.crop || {x:0,y:0,width:1,height:1};
  const sx=crop.x*(image.naturalWidth||image.width),sy=crop.y*(image.naturalHeight||image.height),sw=crop.width*(image.naturalWidth||image.width),sh=crop.height*(image.naturalHeight||image.height);
  const scale = Math.min(1, 2400 / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale)), height = Math.max(1, Math.round(sh * scale));
  const sideways = page.rotation % 180 !== 0;
  canvas.width = sideways ? height : width;
  canvas.height = sideways ? width : height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("此瀏覽器無法處理圖片");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(page.rotation * Math.PI / 180);
  ctx.drawImage(image, sx, sy, sw, sh, -width / 2, -height / 2, width, height);
  return canvas;
}
$("pdf").onclick = async () => {
  if (busy || !pages.length) return;
  lock(true);
  try {
    if (!window.jspdf) throw Error("PDF 程式尚未下載，請連網後重試");
    const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    for (let i = 0; i < pages.length; i++) {
      msg(`建立 PDF ${i + 1}/${pages.length}`);
      if (i) pdf.addPage();
      const canvas = await pageCanvas(pages[i]), fit = Math.min(210 / canvas.width, 297 / canvas.height);
      const width = canvas.width * fit, height = canvas.height * fit;
      pdf.addImage(canvas.toDataURL("image/jpeg", .85), "JPEG", (210 - width) / 2, (297 - height) / 2, width, height);
    }
    pdf.save("smartscan.pdf");
    msg("已建立 PDF");
  } catch (error) { msg("PDF 失敗：" + error.message); }
  finally { lock(false); }
};
$("ocr").onclick = async () => {
  if (busy || !pages.length) return;
  let worker;
  let recognizingPage=-1;
  lock(true);
  try {
    if (!window.Tesseract) throw Error("OCR 程式尚未下載，請連網後重試");
    msg("下載／初始化 OCR…首次語言模型約 13–15 MB／語言，請保持連網");
    worker = await window.Tesseract.createWorker($("language").value, 1, {
      workerPath: config.workerPath, corePath: config.corePath,
      langPath: config.langPath, gzip: config.gzip, cachePath: config.cachePath,
      logger: data=>{
        if(data.status==="recognizing text"&&recognizingPage>=0){
          const fraction=typeof data.progress==="number"&&Number.isFinite(data.progress)?Math.max(0,Math.min(1,data.progress)):0;
          setWorkProgress((recognizingPage+fraction)/pages.length*100,"辨識所有頁面",`第 ${recognizingPage+1} / ${pages.length} 頁 · 辨識中`);
        }else if(recognizingPage<0){
          const downloading=data.status==="loading language traineddata";
          setWorkProgress(downloading&&typeof data.progress==="number"?data.progress*100:null,downloading?"下載語言資料":"準備文字辨識",downloading?"目前語言資料項目的下載進度":"正在初始化辨識引擎，這個階段無法預估百分比。");
        }
      }
    });
    const results = [];
    for (let i = 0; i < pages.length; i++) {
      msg(`辨識 ${i + 1}/${pages.length}`);
      recognizingPage=i;setWorkProgress(i/pages.length*100,"辨識所有頁面",`第 ${i+1} / ${pages.length} 頁`);
      const canvas=await pageCanvas(pages[i]),data=(await worker.recognize(canvas)).data;
      results.push({text:data.text,words:(data.words || []).map(word=>({text:word.text,bbox:word.bbox})),ocrWidth:canvas.width,ocrHeight:canvas.height,ocrKey:JSON.stringify([pages[i].rotation,pages[i].crop || null,pages[i].perspective || null])});
      setWorkProgress((i+1)/pages.length*100,"辨識所有頁面",`第 ${i+1} / ${pages.length} 頁已辨識`);
    }
    results.forEach((result,i)=>Object.assign(pages[i],result));
    $("text").value = results.map(result=>result.text).join("\n\n--- 下一頁 ---\n\n");
    if ($("mode").value === "card") parseCard($("text").value);
    if(typeof suggestDocument === "function")suggestDocument(false);
    if(typeof markDirty === "function")markDirty();
    if($("searchable-pdf"))$("searchable-pdf").checked=pages.every(page=>page.text?.trim());
    msg("OCR 完成，請核對內容；可儲存與匯出可搜尋 PDF");
  } catch (error) { msg("OCR 失敗：" + error.message); }
  finally {
    try { if (worker) await worker.terminate(); }
    catch (error) { msg("OCR 結束失敗：" + error.message); }
    finally { lock(false); }
  }
};
function parseCard(text) {
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  $("email").value = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || "";
  $("phone").value = lines.map(line => line.match(/(?:\+?\d[\d() -]{7,}\d)/)?.[0]).find(Boolean) || "";
  $("name").value = lines.find(line => !line.includes("@") && !/\d{4}/.test(line)) || "";
  $("company").value = "";
  updateCardPreview();
}
$("copy").onclick = async () => {
  try { await navigator.clipboard.writeText($("text").value); msg("已複製"); }
  catch (error) { msg("複製失敗：" + error.message); }
};
$("translate").onclick = () => {
  const text = $("text").value.trim();
  if (!text) return msg("請先辨識文字");
  window.open("https://translate.google.com/?sl=auto&tl=zh-TW&text=" + encodeURIComponent(text.slice(0, 3500)) + "&op=translate", "_blank", "noopener,noreferrer");
};
const escapeVCard = text => String(text || "").replace(/\\/g, "\\\\").replace(/\r\n?|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
function foldVCard(line) {
  const encoder = new TextEncoder();
  let current = "", bytes = 0;
  const parts = [];
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) { parts.push(current); current = " "; bytes = 1; }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n");
}
function buildVCard({ name, company, phone, email }) {
  const displayName = name.trim() || phone.trim() || email.trim();
  if (!displayName) throw Error("請填姓名、電話或 Email");
  // Keep the full supplied name in the given-name component; do not guess family names.
  return ["BEGIN:VCARD", "VERSION:3.0", "FN:" + escapeVCard(displayName), "N:;" + escapeVCard(name.trim()) + ";;;",
    "ORG:" + escapeVCard(company), "TEL:" + escapeVCard(phone), "EMAIL:" + escapeVCard(email), "END:VCARD"]
    .map(foldVCard).join("\r\n") + "\r\n";
}
$("vcard").onclick = () => {
  let url;
  try {
    const fields = Object.fromEntries(["name", "company", "phone", "email"].map(id => [id, $(id).value]));
    url = URL.createObjectURL(new Blob([buildVCard(fields)], { type: "text/vcard;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = (fields.name.trim() || "contact").replace(/[\x00-\x1f\\/:*?"<>|]/g, "_") + ".vcf";
    document.body.append(anchor);
    try { anchor.click(); } finally { anchor.remove(); }
    msg("已建立名片檔，請確認匯入內容");
  } catch (error) { msg("名片匯出失敗：" + error.message); }
  finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 30000); }
};
function showView(view, focusTab = false) {
  if (!["scan", "library", "text", "card"].includes(view) || busy) return;
  for (const panel of document.querySelectorAll("[data-panel]")) panel.hidden = panel.dataset.panel !== view;
  for (const tab of document.querySelectorAll('[role="tab"]')) {
    const active = tab.dataset.view === view;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focusTab) tab.focus();
  }
  if(view === "library" && typeof renderLibrary === "function")renderLibrary();
  if (window.scrollTo) window.scrollTo({ top: 0, behavior: "auto" });
}
for (const button of document.querySelectorAll("[data-view]")) button.onclick = () => showView(button.dataset.view);
for (const tab of document.querySelectorAll('[role="tab"]')) tab.onkeydown = event => {
  const order = ["scan", "library", "text", "card"], index = order.indexOf(tab.dataset.view);
  const target = { ArrowRight: order[(index + 1) % order.length], ArrowLeft: order[(index + order.length - 1) % order.length], Home: "scan", End: "card" }[event.key];
  if (target) { event.preventDefault(); showView(target, true); }
};
function updateCardPreview() {
  if (!$("preview-name")) return;
  const name = $("name").value.trim();
  $("preview-name").textContent = name || "你的下一位聯絡人";
  $("preview-initial").textContent = Array.from(name)[0] || "S";
  $("preview-company").textContent = $("company").value.trim() || "填寫下方資訊，即時預覽名片";
  $("preview-contact").textContent = [$("phone").value.trim(), $("email").value.trim()].filter(Boolean).join(" · ") || "等待加入聯絡資訊";
}
for (const id of ["name", "company", "phone", "email"]) $(id).oninput = updateCardPreview;
if ($("help")) $("help").onclick = () => $("help-dialog").showModal();
if ($("close-help")) $("close-help").onclick = () => $("help-dialog").close();
if ($("home-link")) $("home-link").onclick = event => { event.preventDefault(); showView("scan"); };
render();
