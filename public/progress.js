"use strict";
(function(root){
  class WorkProgress {
    constructor(view,schedule=(callback,delay)=>setTimeout(callback,delay),cancel=id=>clearTimeout(id)){this.view=view;this.schedule=schedule;this.cancel=cancel;this.timer=null;this.active=false;}
    start(){if(this.timer)this.cancel(this.timer);this.timer=null;this.active=true;this.update(null,"準備中","讓紙本慢慢變輕盈，請稍候。");}
    update(value,stage,detail=""){
      if(!this.active)return;
      const percent=typeof value==="number"&&Number.isFinite(value)?Math.max(0,Math.min(100,Math.floor(value))):null;
      this.view({active:true,percent,stage,detail});
    }
    end(detail=""){
      if(!this.active)return;this.active=false;this.view({active:false,percent:null,stage:"處理已結束",detail});
      this.timer=this.schedule(()=>{this.view(null);this.timer=null;},2200);
    }
  }
  if(typeof module!=="undefined"&&module.exports){module.exports=WorkProgress;return;}
  const panel=document.getElementById("work-progress"),bar=document.getElementById("work-bar"),percent=document.getElementById("work-percent");
  root.SmartScanProgress=new WorkProgress(state=>{
    if(!state){panel.hidden=true;return;}
    panel.hidden=false;panel.dataset.running=String(state.active);panel.setAttribute("aria-busy",String(state.active));
    document.getElementById("work-stage").textContent=state.stage;document.getElementById("work-detail").textContent=state.detail;
    percent.textContent=state.percent===null?"請稍候":state.percent+"%";percent.classList.toggle("is-waiting",state.percent===null);
    bar.setAttribute("aria-label",state.stage+"（當前階段）");
    if(state.percent===null)bar.removeAttribute("value");else bar.value=state.percent;
  });
})(globalThis);
