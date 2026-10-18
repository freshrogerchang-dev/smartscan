"use strict";
(function(root){
  class PdfShareDraft {
    constructor(api){this.api=api;this.file=null;this.sharing=false;}
    prepare(file){if(!file||file.type!=="application/pdf"||!file.size)throw Error("無有效的 PDF 可分享");this.file=file;}
    clear(){this.file=null;}
    supported(){try{return !!(this.file&&this.api.share&&this.api.canShare?.({files:[this.file]}));}catch(error){return false;}}
    share(){
      if(this.sharing)throw Error("分享選單已開啟，請先完成或取消");
      if(!this.supported())throw Error("此瀏覽器不支援分享 PDF，請使用下載備份");
      this.sharing=true;
      try{
        // Called synchronously on the second tap; PDF/font work happened earlier.
        return Promise.resolve(this.api.share({files:[this.file],title:this.file.name})).finally(()=>{this.sharing=false;});
      }catch(error){this.sharing=false;throw error;}
    }
  }
  if(typeof module!=="undefined"&&module.exports){module.exports=PdfShareDraft;return;}
  const draft=new PdfShareDraft(navigator);
  $("cloud-prepare").onclick=async()=>{
    if(busy)return;draft.clear();lock(true);
    try{
      const {pdf,name,searchable}=await buildPdfDocument();
      draft.prepare(new File([pdf.output("blob")],name,{type:"application/pdf"}));
      $("share-summary").textContent=`${name} · ${pages.length} 頁 · ${(draft.file.size/1024/1024).toFixed(2)} MB · ${searchable?"含搜尋文字層":"圖片 PDF"}`;
      $("share-message").textContent=draft.supported()?"PDF 已在裝置上準備好，尚未傳送。按下方按鈕，再選 Google Drive 或「儲存到檔案」。":"此瀏覽器無法分享 PDF。可先下載，再到 Google Drive App 上傳；尚未傳送。";
      $("share-native").hidden=!draft.supported();$("share-dialog").showModal();
      msg("PDF 備份已準備好，請選擇分享或下載");
    }catch(error){msg("準備備份失敗："+error.message);}
    finally{lock(false);updateDocumentControls();}
  };
  $("share-native").onclick=()=>{
    if(busy)return;
    try{
      const pending=draft.share();$("share-native").disabled=true;$("share-close").disabled=true;
      pending.then(()=>{$("share-message").textContent="已交給系統分享。請在 Google Drive 確認檔案已儲存；SmartScan 無法確認雲端上傳結果。";},error=>{$("share-message").textContent=error.name==="AbortError"?"已取消分享，PDF 仍留在這個裝置，可再次分享或下載。":"無法分享："+error.message+"。可按下載 PDF 備份，再到 Google Drive 上傳。";}).finally(()=>{$("share-native").disabled=false;$("share-close").disabled=false;});
    }catch(error){$("share-message").textContent=error.message;}
  };
  $("share-download").onclick=()=>{if(draft.file)downloadBlob(draft.file,draft.file.name);};
  $("share-close").onclick=()=>{if(!draft.sharing)$("share-dialog").close();};
  $("share-dialog").addEventListener("close",()=>draft.clear());
})(globalThis);
