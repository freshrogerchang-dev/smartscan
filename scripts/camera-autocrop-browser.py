from pathlib import Path
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
import json
R=Path(__file__).resolve().parents[1];path=Path('/tmp/camera-paper.png')
im=Image.new('RGB',(800,600),(50,50,50));draw=ImageDraw.Draw(im);draw.rectangle((120,100,680,500),fill=(245,245,245))
for y in range(160,430,45):draw.line((180,y,580,y),fill=(30,30,30),width=6)
im.save(path)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':844},service_workers='block');c.route('https://**/*',lambda r:r.abort());page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept());page.goto('http://127.0.0.1:4176/')
 page.locator('#camera').set_input_files(str(path));page.wait_for_function("pages.length===1 && pages[0].autoCropState==='applied' && !busy")
 data=page.evaluate("async()=>({crop:pages[0].crop,bytes:Array.from(new Uint8Array(await pages[0].file.arrayBuffer())),size:[(await pageCanvas(pages[0])).width,(await pageCanvas(pages[0])).height]})")
 assert data['bytes']==list(path.read_bytes());assert data['crop']['x']<.15;assert data['size'][0]<800 and data['size'][1]<600
 page.get_by_role('button',name='第 1 頁裁切',exact=True).click();page.locator('#crop-reset').click();page.locator('#crop-apply').click();assert page.evaluate('pages[0].crop') is None
 page.locator('#camera-auto-crop').uncheck();page.locator('#camera').set_input_files(str(path));page.wait_for_function('pages.length===2 && !busy');assert page.evaluate('pages[1].crop') is None
 page.locator('#upload').set_input_files(str(path));page.wait_for_function('pages.length===3 && !busy');assert page.evaluate('pages[2].crop') is None
 blank=Path('/tmp/camera-white.png');Image.new('RGB',(800,600),'white').save(blank)
 page.locator('#camera-auto-crop').check();page.locator('#camera').set_input_files(str(blank));page.wait_for_function("pages.length===4 && pages[3].autoCropState==='uncertain' && !busy");assert page.evaluate('pages[3].crop') is None
 page.screenshot(path=str(R/'docs/evidence/camera-autocrop-mobile.png'),full_page=True)
 assert not errors,errors
 result={'status':'PASS','browser':b.version,'fixture':'synthetic light document on dark background; not a physical camera test','checks':['camera-auto-applies-crop-through-all-wrappers','source-file-bytes-preserved','cropped-canvas-dimensions','manual-full-image-restore','checkbox-disable','album-import-unchanged','ambiguous-white-image-preserved'],'pageErrors':errors}
 (R/'docs/evidence/camera-autocrop-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));b.close()
