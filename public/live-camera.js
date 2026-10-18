"use strict";
(function(){
 const dialog=$('live-camera-dialog'),video=$('live-camera-video'),overlay=$('live-camera-overlay'),shutter=$('live-camera-shutter'),note=$('live-camera-message');
 let stream=null,timer=null,generation=0,previous=null,stableFrames=0,capturing=false;
 const analysis=document.createElement('canvas');
 function stop(){generation++;clearTimeout(timer);timer=null;if(stream)for(const t of stream.getTracks())t.stop();stream=null;video.srcObject=null;previous=null;stableFrames=0;shutter.disabled=true;overlay.getContext('2d').clearRect(0,0,overlay.width,overlay.height);}
 function bounds(frame){
  const width=frame.videoWidth||frame.width,height=frame.videoHeight||frame.height,scale=Math.min(1,384/Math.max(width,height));analysis.width=Math.max(1,Math.round(width*scale));analysis.height=Math.max(1,Math.round(height*scale));
  const ctx=analysis.getContext('2d',{willReadFrequently:true});ctx.drawImage(frame,0,0,analysis.width,analysis.height);return window.SmartScanTools.autoCropBounds(ctx.getImageData(0,0,analysis.width,analysis.height));
 }
 function tick(id){
  if(id!==generation||!stream||!dialog.open)return;
  try{if(video.readyState>=2&&video.videoWidth){
   const candidate=bounds(video);stableFrames=window.SmartScanCardTools.stable(previous,candidate)?stableFrames+1:0;previous=candidate;
   overlay.width=Math.max(1,Math.round(video.clientWidth));overlay.height=Math.max(1,Math.round(video.clientHeight));const ctx=overlay.getContext('2d'),fit=window.SmartScanCardTools.contain(video.videoWidth,video.videoHeight,overlay.width,overlay.height);
   const b=candidate||{x:.12,y:.15,width:.76,height:.7};ctx.lineWidth=3;ctx.strokeStyle=candidate?(stableFrames>=2?'#32d583':'#ffca55'):'#ffffff';ctx.setLineDash(candidate?[]:[8,6]);ctx.strokeRect(fit.x+b.x*fit.width,fit.y+b.y*fit.height,b.width*fit.width,b.height*fit.height);
   note.textContent=candidate?(stableFrames>=2?($('camera-auto-crop')?.checked===false?'邊界穩定；自動裁切已關閉，拍攝會保留完整圖片。':'邊界穩定，可拍攝；拍攝後會依目前畫面自動裁切。'):'已找到邊界，請保持穩定。'):'尚未確認邊界，請將整張名片／文件置於深色背景並保持水平；仍可拍攝後手動裁切。';
   shutter.disabled=false;
  }}catch{note.textContent='即時邊界偵測暫時不可用，仍可拍攝後手動裁切。';shutter.disabled=!video.videoWidth;}
  timer=setTimeout(()=>tick(id),220);
 }
 async function start(){
  if(busy||capturing)return;stop();if(!dialog.open){$('live-camera-kind').value=$('mode').value==='card'?'card':'document';dialog.showModal();}const id=generation;
  shutter.textContent=$('camera-auto-crop')?.checked===false?'拍攝（保留完整圖片）':'拍攝並裁切';note.textContent='正在開啟相機，請允許權限…';$('live-camera-start').disabled=true;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('此瀏覽器不支援網頁相機，請使用下方系統相機');
   const incoming=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
   if(id!==generation||!dialog.open||document.visibilityState!=='visible'){incoming.getTracks().forEach(t=>t.stop());return;}
   stream=incoming;incoming.getVideoTracks()[0]?.addEventListener('ended',()=>{if(stream===incoming){stop();note.textContent='相機已停止，請按重新開啟相機。';}});video.srcObject=incoming;await video.play();if(id!==generation)return;tick(id);
  }catch(error){if(id===generation){stop();note.textContent=error.name==='NotAllowedError'?'相機權限未允許。可在 Safari 網站設定允許相機，或使用系統相機。':'相機無法開啟：'+error.message;}}
  finally{$('live-camera-start').disabled=false;}
 }
 $('live-camera-open').onclick=start;$('live-camera-start').onclick=start;
 $('live-camera-close').onclick=()=>dialog.close();dialog.addEventListener('close',stop);
 $('live-camera-native').onclick=()=>{dialog.close();$('camera').click();};
 shutter.onclick=async()=>{
  if(capturing||!stream||!video.videoWidth)return;const captureGeneration=generation;capturing=true;shutter.disabled=true;
  try{
   const c=document.createElement('canvas'),scale=Math.min(1,3200/Math.max(video.videoWidth,video.videoHeight));c.width=Math.max(1,Math.round(video.videoWidth*scale));c.height=Math.max(1,Math.round(video.videoHeight*scale));c.getContext('2d').drawImage(video,0,0,c.width,c.height);
   const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('無法拍攝影像')),'image/jpeg',.94));
   if(captureGeneration!==generation||!dialog.open)return;
   $('mode').value=$('live-camera-kind').value;
   const options={autoCrop:$('camera-auto-crop')?.checked!==false};stop();dialog.close();await add([new File([blob],'camera-'+Date.now()+'.jpg',{type:'image/jpeg'})],options);
  }catch(error){note.textContent='拍攝失敗：'+error.message;msg(note.textContent);}
  finally{capturing=false;shutter.disabled=!stream;}
 };
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&dialog.open){stop();note.textContent='相機已在背景停止，請按重新開啟相機。';}});
 window.addEventListener('pagehide',stop);
})();
