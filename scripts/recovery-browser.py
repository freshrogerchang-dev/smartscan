from playwright.sync_api import sync_playwright
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1];url='http://127.0.0.1:4174/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 def ctx():
  c=b.new_context(accept_downloads=True,service_workers='block',viewport={'width':390,'height':844})
  c.route('https://**/*',lambda r:r.abort());return c
 c=ctx();page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(url);page.wait_for_function("document.getElementById('draft-status').textContent.includes('自動')")
 page.locator('#recovery-panel summary').click()
 page.locator('#upload').set_input_files(str(R/'public/icon-192.png'))
 page.get_by_role('button',name='第 1 頁旋轉',exact=True).click()
 page.locator('#document-name').fill('恢復測試')
 page.evaluate("document.getElementById('text').value='原文未儲存測試';document.getElementById('text').dispatchEvent(new Event('input',{bubbles:true}))")
 page.locator('#draft-save').click();page.wait_for_function("document.getElementById('draft-status').textContent.includes('已儲存')")
 page.reload();page.wait_for_function("!document.getElementById('draft-recover').hidden")
 assert page.locator('#pages figure').count()==0
 page.locator('#draft-restore').click();page.wait_for_function("document.getElementById('document-name').value==='恢復測試'")
 assert page.evaluate("pages[0].rotation")==90
 assert page.locator('#text').input_value()=='原文未儲存測試'
 assert page.evaluate("pages[0].file.name")=='icon-192.png'
 page.locator('#save-document').click();page.wait_for_function("document.getElementById('status').textContent.includes('已儲存到')")
 page.locator('#tab-card').click();page.locator('#name').fill('測試聯絡人');page.locator('#phone').fill('+886912345678');page.locator('#contact-save').click()
 page.wait_for_function("document.getElementById('status').textContent.includes('已儲存本機聯絡人')")
 page.locator('#tab-library').click();page.locator('#backup-panel summary').click()
 with page.expect_download() as event:page.locator('#backup-export').click()
 backup=R/'docs/evidence/recovery-test-backup.smartscan.json';event.value.save_as(str(backup))
 first=page.evaluate("documentLibrary.list().then(r=>r.length)");assert first==2,first
 other=ctx();target=other.new_page();otherErrors=[];target.on('pageerror',lambda e:otherErrors.append(str(e)))
 target.goto(url);target.wait_for_function("document.getElementById('draft-status').textContent.includes('自動')")
 target.locator('#tab-library').click();target.locator('#backup-panel summary').click();target.locator('#backup-file').set_input_files(str(backup))
 target.wait_for_function("!document.getElementById('backup-confirm').hidden")
 assert target.evaluate("documentLibrary.list().then(r=>r.length)")==0
 target.locator('#backup-confirm').click();target.wait_for_function("document.getElementById('backup-message').textContent.includes('還原完成')")
 assert target.evaluate("documentLibrary.list().then(r=>r.length)")==2
 assert target.evaluate("documentLibrary.list().then(r=>r.every(d=>d.name.endsWith('還原副本')))")
 assert target.evaluate("documentLibrary.list().then(r=>r.some(d=>d.kind==='contact'&&d.contact.phone==='+886912345678'))")
 target.locator('#tab-scan').click();target.locator('#draft-restore').click()
 target.wait_for_function("pages.length===1")
 assert target.evaluate("pages[0].rotation")==90
 original=(R/'public/icon-192.png').read_bytes()
 assert target.evaluate("pages[0].file.arrayBuffer().then(b=>Array.from(new Uint8Array(b)))")==list(original)
 # Re-import preserves existing records and only adds new IDs.
 target.locator('#tab-library').click();target.locator('#backup-file').set_input_files(str(backup));target.wait_for_function("!document.getElementById('backup-confirm').hidden")
 target.locator('#backup-confirm').click();target.wait_for_function("documentLibrary.list().then(r=>r.length===4)")
 # Corrupt backup must not mutate the library.
 envelope=json.loads(backup.read_text());envelope['payload']+='x'
 corrupt=R/'docs/evidence/corrupt-test.json';corrupt.write_text(json.dumps(envelope))
 target.locator('#backup-file').set_input_files(str(corrupt));target.wait_for_function("document.getElementById('backup-message').textContent.includes('無法還原')")
 assert target.evaluate("documentLibrary.list().then(r=>r.length)")==4
 # Native IndexedDB transaction abort rolls back earlier writes in the same import.
 result=target.evaluate("""async()=>{const r=(await documentLibrary.list())[0];const count=(await documentLibrary.list()).length;try{await documentLibrary.importBackup([{...r,id:'collision-test'},{...r,id:'collision-test'}],[]);return false;}catch{return (await documentLibrary.list()).length===count&&!(await documentLibrary.get('collision-test'));}}""")
 assert result
 # Quota failure must show an unsaved warning and preserve the working image.
 target.locator('#tab-scan').click();target.evaluate("documentLibrary.saveDraft=async()=>{throw new DOMException('Quota exceeded','QuotaExceededError')};document.getElementById('document-name').value='寫入失敗';document.getElementById('document-name').dispatchEvent(new Event('input',{bubbles:true}))")
 target.locator('#draft-save').click();target.wait_for_function("document.getElementById('draft-status').textContent.includes('未儲存')")
 assert target.evaluate('pages.length')==1
 target.screenshot(path=str(R/'docs/evidence/recovery-mobile.png'),full_page=True)
 assert not errors,errors
 assert not otherErrors,otherErrors
 print(json.dumps({'browser':b.version,'checks':['draft-reload-recovery','original-file-byte-equality','rotation-text-retention','contact-backup','fresh-context-import-preview-confirm','non-overwrite-repeat-import','checksum-rejection','native-IDB-atomic-rollback','quota-failure-warning'],'status':'PASS','pageErrors':errors+otherErrors}))
 b.close()
