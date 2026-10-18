from playwright.sync_api import sync_playwright
from pathlib import Path
import json,zipfile
R=Path(__file__).resolve().parents[1];OUT=R/'docs/evidence';URL='http://127.0.0.1:4175/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(accept_downloads=True,service_workers='block',viewport={'width':390,'height':844})
 c.route('https://**/*',lambda r:r.abort());page=c.new_page();page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));accept=lambda d:d.accept();page.on('dialog',accept)
 page.goto(URL);page.wait_for_function("document.getElementById('draft-status').textContent.includes('自動')")
 assert not errors,errors
 print('loaded',flush=True)
 # Create a real 2-page text PDF using the locally vendored jsPDF.
 pdf=page.evaluate("""()=>{const p=new jspdf.jsPDF();p.setFillColor(255,0,0);p.rect(10,10,20,20,'F');p.text('SECRET123 on page one',20,40);p.addPage();p.setFillColor(0,0,255);p.rect(10,10,20,20,'F');p.text('Second page receipt',20,40);return Array.from(new Uint8Array(p.output('arraybuffer')))}""")
 (OUT/'eight-input.pdf').write_bytes(bytes(pdf))
 page.get_by_text('PDF 匯入、合併與拆頁',exact=True).click()
 page.locator('#pdf-import').set_input_files(str(OUT/'eight-input.pdf'))
 page.wait_for_function('pages.length===2',timeout=45000)
 assert not errors,errors
 print('pdf imported',flush=True)
 page.locator('#quality-panel summary').click();page.locator('#quality-check').click();page.wait_for_function("document.querySelectorAll('#quality-results li').length===2")
 # Selection preserves order and creates real PDFs.
 page.locator('#pdf-range').fill('2,1')
 with page.expect_download() as e:page.locator('#pdf-range-export').click()
 selected=OUT/'eight-selected.pdf';e.value.save_as(str(selected))
 with page.expect_download() as e:page.locator('#pdf-split').click()
 split=OUT/'eight-split.zip';e.value.save_as(str(split))
 with zipfile.ZipFile(split) as z:assert z.namelist()==['page-2.pdf','page-1.pdf'];assert z.read('page-2.pdf').startswith(b'%PDF-')
 color=page.evaluate('''async bytes=>{const lib=await import('/vendor/pdfjs/pdf.mjs');lib.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';const doc=await lib.getDocument({data:new Uint8Array(bytes)}).promise;if(doc.numPages!==2)throw Error('wrong page count');const p=await doc.getPage(1),c=document.createElement('canvas'),v=p.getViewport({scale:1});c.width=v.width;c.height=v.height;await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;const pixel=Array.from(c.getContext('2d').getImageData(42,42,1,1).data);await doc.destroy();return pixel;}''',list(selected.read_bytes()))
 assert color[2]>180 and color[0]<80,color
 print('pdf exported/split/order checked',flush=True)
 # OCR fixture tests the actual comparison UI, not OCR accuracy.
 page.evaluate("""async()=>{const p=pages[0],c=await pageCanvas(p);p.text='SECRET123';p.words=[{text:'SECRET123',bbox:{x0:100,y0:100,x1:300,y1:150}}];p.ocrWidth=c.width;p.ocrHeight=c.height;p.ocrKey=JSON.stringify([p.rotation,p.crop||null,p.perspective||null]);refreshEditor()}""")
 page.locator('#tab-text').click();page.locator('#review-panel summary').click();page.locator('#review-open').click();page.wait_for_function("document.querySelectorAll('#review-words button').length===1")
 page.locator('#review-words button').click();page.locator('#review-text').fill('Corrected text');page.locator('#review-save').click()
 assert page.evaluate('pages[0].text')=='Corrected text';assert page.evaluate('pages[0].words.length')==0
 print('review corrected',flush=True)
 # Claim fields persist with the document and export with the original attachments.
 page.get_by_text('報帳資料與狀態',exact=True).click()
 for k,v in {'store':'Test Store','tax':'5.00','payment':'cash','reference':'R-001','note':'fixture'}.items():page.locator('#claim-'+k).fill(v)
 page.locator('#claim-status').select_option('pending')
 page.evaluate("document.getElementById('receipt-date').value='2026-10-18';document.getElementById('receipt-currency').value='TWD';document.getElementById('receipt-amount').value='105.00'")
 page.locator('#tab-scan').click();page.locator('#document-name').fill('Expense fixture');page.locator('#save-document').click()
 page.wait_for_function("documentLibrary.list().then(r=>r.length===1)")
 saved=page.evaluate("documentLibrary.list().then(r=>r[0].receipt)");assert saved['tax']=='5.00' and saved['status']=='pending',saved
 page.locator('#tab-library').click();page.get_by_text('支出報告',exact=True).click();page.locator('#claim-filter').select_option('pending')
 with page.expect_download() as e:page.locator('#claim-bundle').click()
 bundle=OUT/'eight-claims.zip';e.value.save_as(str(bundle))
 with zipfile.ZipFile(bundle) as z:
  assert 'report.csv' in z.namelist();assert 'Test Store' in z.read('report.csv').decode();assert 'receipts/1/page-1.jpg' in z.namelist();assert len(json.loads(z.read('manifest.json')))==1
 print('claims exported',flush=True)
 # Invalid PDF import rolls back without changing the existing pages.
 page.locator('#tab-scan').click();(OUT/'eight-invalid.pdf').write_bytes(b'%PDF-1.7 corrupt fixture')
 page.locator('#pdf-import').set_input_files(str(OUT/'eight-invalid.pdf'));page.wait_for_function("document.getElementById('pdf-organize-message').textContent.includes('失敗')")
 assert page.evaluate('pages.length')==2
 # A duplicate document save also asks before adding another record.
 original_id=page.evaluate('currentDocumentId');page.evaluate('currentDocumentId=null')
 page.remove_listener('dialog',accept);save_dialogs=[]
 reject_save=lambda d:(save_dialogs.append(d.message),d.dismiss());page.on('dialog',reject_save)
 page.locator('#save-document').click();page.wait_for_function("document.getElementById('duplicate-message').textContent.includes('已取消')")
 assert page.evaluate("documentLibrary.list().then(r=>r.length)")==1
 assert any('相同' in m for m in save_dialogs)
 page.remove_listener('dialog',reject_save);page.on('dialog',accept);page.evaluate('id=>currentDocumentId=id',original_id)
 # Duplicate-image warning rejects exact bytes when user cancels.
 page.locator('#tab-scan').click();raw=page.evaluate('pages[0].file.arrayBuffer().then(b=>Array.from(new Uint8Array(b)))');(OUT/'eight-same.jpg').write_bytes(bytes(raw))
 page.remove_listener('dialog',page._impl_obj if False else lambda x:None) if False else None
 page.remove_listener('dialog',accept);dialogs=[]
 dismiss=lambda d:(dialogs.append(d.message),d.dismiss());page.on('dialog',dismiss)
 page.locator('#upload').set_input_files(str(OUT/'eight-same.jpg'));page.wait_for_function('!busy')
 assert page.evaluate('pages.length')==2
 assert any('完全相同' in d for d in dialogs),dialogs
 page.remove_listener('dialog',dismiss);page.on('dialog',accept)
 print('duplicates declined',flush=True)
 # Redaction truly replaces pixels and invalidates hidden text and derived data.
 page.locator('#redact-panel summary').click();page.locator('#redact-open').click();page.wait_for_function("document.getElementById('redact-message').textContent.includes('預覽')")
 for k,v in {'x':'0','y':'0','width':'100','height':'100'}.items():page.locator('#redact-'+k).fill(v)
 page.locator('#redact-add').click();page.locator('#redact-apply').click();page.wait_for_function("pages[0].redacted===true")
 assert page.evaluate('pages[0].text')=='';assert page.evaluate('pages[0].words.length')==0
 assert page.evaluate("document.getElementById('claim-store').value")==''
 assert page.evaluate("currentDocumentId===null")
 black=page.evaluate("""async()=>{const c=await pageCanvas(pages[0]);return Array.from(c.getContext('2d').getImageData(10,10,1,1).data)}""");assert black==[0,0,0,255],black
 with page.expect_download() as e:page.locator('#pdf').click()
 redacted=OUT/'eight-redacted.pdf';e.value.save_as(str(redacted))
 # Re-open exported bytes with PDF.js and verify there is no secret text layer.
 text=page.evaluate("""async(bytes)=>{const lib=await import('/vendor/pdfjs/pdf.mjs');lib.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';const d=await lib.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;let text='';for(let i=1;i<=d.numPages;i++)text+=(await(await d.getPage(i)).getTextContent()).items.map(x=>x.str).join('');await d.destroy();return text;}""",list(redacted.read_bytes()))
 assert 'SECRET123' not in text and 'Corrected text' not in text,text
 assert page.evaluate("documentLibrary.list().then(r=>r[0].pages[0].file.name)")!='redacted-page.png'
 page.screenshot(path=str(OUT/'eight-mobile.png'),full_page=True)
 assert not errors,errors
 print(json.dumps({'status':'PASS','browser':b.version,'checks':['real-PDF-import-two-pages','PDF-selected-order-and-split-ZIP','quality-report','OCR-fixture-comparison-and-correction','receipt-state-persistence-and-attachment-ZIP','exact-duplicate-decline','burned-black-pixels','hidden-OCR-cleared','exported-PDF-no-secret-text','saved-original-preserved'],'pageErrors':errors}))
 b.close()
