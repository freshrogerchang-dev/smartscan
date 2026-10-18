from pathlib import Path
from playwright.sync_api import sync_playwright
import json
R=Path(__file__).resolve().parents[1];fixture=Path('/tmp/smartscan-camera.y4m');w,h=640,480
y=bytearray([50])*(w*h)
for row in range(100,380):y[row*w+90:row*w+550]=bytes([225])*460
for row in range(155,345,40):
 for dy in range(4):y[(row+dy)*w+145:(row+dy)*w+495]=bytes([35])*350
with fixture.open('wb') as f:
 f.write(b'YUV4MPEG2 W640 H480 F5:1 Ip A1:1 C420jpeg\n');frame=bytes(y)+bytes([128])*(w*h//2)
 for _ in range(20):f.write(b'FRAME\n'+frame)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-fake-device-for-media-stream','--use-file-for-fake-video-capture='+str(fixture)])
 c=b.new_context(permissions=['camera'],viewport={'width':390,'height':844},service_workers='block');c.route('https://**/*',lambda r:r.abort());page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:4177/');page.locator('#live-camera-open').click();page.wait_for_function("document.getElementById('live-camera-message').textContent.includes('穩定，可拍攝')",timeout=20000)
 page.locator('#live-camera-kind').select_option('card');page.evaluate("window.testTracks=[...document.getElementById('live-camera-video').srcObject.getTracks()]")
 page.screenshot(path=str(R/'docs/evidence/live-camera-guide.png'))
 page.locator('#live-camera-shutter').click();page.wait_for_function("pages.length===1&&pages[0].crop!==null&&!busy",timeout=20000)
 assert page.evaluate("document.getElementById('mode').value")=='card'
 assert page.evaluate("window.testTracks.every(t=>t.readyState==='ended')")
 assert page.evaluate("document.getElementById('live-camera-video').srcObject===null")
 assert not page.locator('#live-camera-dialog').is_visible()
 page.evaluate("parseCard('LITEINI=)\\n+886 21234 5678\\njackyliu@example.test')")
 assert page.locator('#name').input_value()==''
 assert page.locator('#company').input_value()=='LITEINI=)'
 assert page.locator('#email').input_value()=='jackyliu@example.test'
 page.locator('#tab-card').click();page.screenshot(path=str(R/'docs/evidence/card-fields-corrected.png'),full_page=True)
 page.evaluate("parseCard('範例科技股份有限公司\\n王小明\\n業務經理\\nEmail: person@example.test')")
 assert page.locator('#name').input_value()=='王小明';assert page.locator('#company').input_value()=='範例科技股份有限公司'
 # Close/reopen and ensure all tracks are stopped on cancellation.
 page.locator('#tab-scan').click();page.locator('#live-camera-open').click();page.wait_for_function("document.getElementById('live-camera-video').videoWidth>0&&document.getElementById('live-camera-video').srcObject!==null")
 page.evaluate("window.closeTracks=[...document.getElementById('live-camera-video').srcObject.getTracks()]");page.locator('#live-camera-close').click();page.wait_for_function("window.closeTracks.every(t=>t.readyState==='ended')")
 # Permission denial retains a working native camera fallback.
 denied=b.new_context(permissions=[],service_workers='block');denied.grant_permissions([],origin='http://127.0.0.1:4177');denied.route('https://**/*',lambda r:r.abort());q=denied.new_page();q.goto('http://127.0.0.1:4177/');q.locator('#live-camera-open').click()
 q.wait_for_function("document.getElementById('live-camera-message').textContent.includes('權限')||document.getElementById('live-camera-message').textContent.includes('無法開啟')",timeout=15000)
 with q.expect_file_chooser() as chooser:q.locator('#live-camera-native').click()
 assert not chooser.value.is_multiple()
 assert not errors,errors
 result={'status':'PASS','browser':b.version,'camera':'real getUserMedia with Chromium fake Y4M video device; not physical iPhone','checks':['continuous-frame-edge-detection','stable-guide','capture-auto-crops','card-mode-selected','tracks-stop-after-capture','tracks-stop-after-close','logo-not-name','company-and-person-separated','permission-denied-native-fallback'],'pageErrors':errors}
 (R/'docs/evidence/live-camera-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));b.close()
