"use strict";
class SmartScanLibrary {
  constructor(factory = globalThis.indexedDB) { this.factory = factory; this.connection = null; }
  async open() {
    if(this.connection)return this.connection;
    if(!this.factory)throw Error("這個瀏覽器無法使用本機文件庫；請先下載 PDF 備份");
    this.connection = new Promise((resolve,reject)=>{
      const request=this.factory.open("smartscan-personal",2);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains("recovery"))db.createObjectStore("recovery",{keyPath:"id"});
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
  async transaction(mode, action, storeName = "documents") {
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,mode),store=tx.objectStore(storeName);let result;
      tx.oncomplete=()=>resolve(result);
      tx.onerror=tx.onabort=()=>reject(tx.error || Error("文件庫寫入未完成，請下載 PDF 備份"));
      try {const request=action(store);request.onsuccess=()=>{result=request.result;};}
      catch(error){tx.abort();reject(error);}
    });
  }
  drafts(){return this.transaction("readonly",store=>store.getAll(),"recovery");}
  saveDraft(record){return this.transaction("readwrite",store=>store.put(record),"recovery");}
  removeDraft(id){return this.transaction("readwrite",store=>store.delete(id),"recovery");}
  async backupSnapshot() {
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(["documents","recovery"],"readonly"),snapshot={};
      tx.oncomplete=()=>resolve(snapshot);
      tx.onerror=tx.onabort=()=>reject(tx.error||Error("無法讀取完整備份快照"));
      const documents=tx.objectStore("documents").getAll(),drafts=tx.objectStore("recovery").getAll();
      documents.onsuccess=()=>{snapshot.documents=documents.result;};
      drafts.onsuccess=()=>{snapshot.drafts=drafts.result;};
    });
  }
  async importBackup(records,drafts) {
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(["documents","recovery"],"readwrite");
      tx.oncomplete=()=>resolve();
      tx.onerror=tx.onabort=()=>reject(tx.error||Error("還原未完成，原有文件不受影響"));
      try{for(const r of records)tx.objectStore("documents").add(r);for(const d of drafts)tx.objectStore("recovery").add(d);}
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
