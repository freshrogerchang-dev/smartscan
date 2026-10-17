"use strict";
class SmartScanLibrary {
  constructor(factory = globalThis.indexedDB) { this.factory = factory; this.connection = null; }
  async open() {
    if(this.connection)return this.connection;
    if(!this.factory)throw Error("這個瀏覽器無法使用本機文件庫；請先下載 PDF 備份");
    this.connection = new Promise((resolve,reject)=>{
      const request=this.factory.open("smartscan-personal",1);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains("documents"))db.createObjectStore("documents",{keyPath:"id"});
      };
      request.onerror=()=>reject(request.error || Error("無法開啟文件庫"));
      request.onblocked=()=>reject(Error("請關閉其他 SmartScan 分頁後重試"));
      request.onsuccess=()=>{
        const db=request.result;
        db.onversionchange=()=>{db.close();this.connection=null;};
        resolve(db);
      };
    }).catch(error=>{this.connection=null;throw error;});
    return this.connection;
  }
  async transaction(mode, action) {
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction("documents",mode),store=tx.objectStore("documents");let result;
      tx.oncomplete=()=>resolve(result);
      tx.onerror=tx.onabort=()=>reject(tx.error || Error("文件庫寫入未完成，請下載 PDF 備份"));
      try {const request=action(store);request.onsuccess=()=>{result=request.result;};}
      catch(error){tx.abort();reject(error);}
    });
  }
  list(){return this.transaction("readonly",store=>store.getAll());}
  get(id){return this.transaction("readonly",store=>store.get(id));}
  put(record){return this.transaction("readwrite",store=>store.put(record));}
  remove(id){return this.transaction("readwrite",store=>store.delete(id));}
}
if(typeof module !== "undefined" && module.exports)module.exports=SmartScanLibrary;
else window.SmartScanLibrary=SmartScanLibrary;
