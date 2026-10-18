from playwright.sync_api import sync_playwright
import json
URL='http://127.0.0.1:4174'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context();c.route('https://**/*',lambda r:r.abort())
 page=c.new_page();page.goto(URL+'/missing')
 page.evaluate('''()=>new Promise((resolve,reject)=>{const r=indexedDB.open('smartscan-personal',1);r.onupgradeneeded=()=>r.result.createObjectStore('documents',{keyPath:'id'});r.onsuccess=()=>{const db=r.result,tx=db.transaction('documents','readwrite');tx.objectStore('documents').put({id:'legacy',kind:'contact',name:'舊聯絡人',category:'card',text:'保留',pages:[],language:'eng',mode:'card',createdAt:1,updatedAt:2,contact:{name:'舊聯絡人',company:'',email:'',phone:'123'}});tx.oncomplete=()=>{db.close();resolve()};};r.onerror=()=>reject(r.error);})''')
 page.goto(URL);page.wait_for_function("document.getElementById('draft-status').textContent.includes('自動')")
 assert page.evaluate("documentLibrary.get('legacy').then(r=>r.name)")=='舊聯絡人'
 assert page.evaluate("documentLibrary.open().then(db=>db.version)")==2
 page.locator('#recovery-panel summary').click()
 for tab,text in [(page,'第一個分頁文字')]:
  tab.evaluate("text=>{document.getElementById('text').value=text;document.getElementById('text').dispatchEvent(new Event('input',{bubbles:true}))}",text)
  tab.locator('#draft-save').click();tab.wait_for_function("document.getElementById('draft-status').textContent.includes('已儲存')")
 second=c.new_page();second.goto(URL);second.wait_for_function("document.getElementById('draft-status').textContent.includes('找到')")
 second.evaluate("document.getElementById('text').value='第二個分頁文字';document.getElementById('text').dispatchEvent(new Event('input',{bubbles:true}))")
 second.locator('#draft-save').click();second.wait_for_function("document.getElementById('draft-status').textContent.includes('已儲存')")
 texts=second.evaluate("documentLibrary.drafts().then(ds=>ds.map(d=>d.ui.text))")
 assert '第一個分頁文字' in texts and '第二個分頁文字' in texts,texts
 # Install the actual service worker and confirm recovery UI loads without network.
 second.evaluate('navigator.serviceWorker.ready');second.reload();second.wait_for_function('navigator.serviceWorker.controller!==null')
 c.set_offline(True);second.reload();second.wait_for_function("!document.getElementById('draft-recover').hidden")
 second.locator('#draft-restore').click();second.wait_for_function("document.getElementById('text').value.length>0")
 assert second.locator('#text').input_value() in texts
 second.screenshot(path=str(__import__('pathlib').Path(__file__).resolve().parents[1]/'docs/evidence/recovery-offline-mobile.png'),full_page=True)
 print(json.dumps({'status':'PASS','checks':['v1-to-v2-migration-preserves-documents','multi-tab-independent-drafts','offline-shell-and-draft-recovery']}))
 b.close()
