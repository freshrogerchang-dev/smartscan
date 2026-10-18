"use strict";
(function(root){
 const org=/公司|企業|集團|商行|工作室|醫院|診所|協會|基金會|研究所|大學|股份|有限|科技|實業|生技|醫療|\b(?:Co\.?|Ltd\.?|Inc\.?|Corp\.?|Corporation|Company|Group|Technology|Technologies|Medical|Hospital|Clinic|University|Laboratories|Labs|Solutions|Services|Systems|International|Electronics|Industries|Trading|Limited)\b/i;
 const job=/總經理|副總|經理|總監|主任|工程師|業務|醫師|教授|董事|執行長|專員|顧問|\b(?:Manager|Director|Engineer|Consultant|Sales|CEO|CTO|President|Professor)\b/i;
 const surname=/^(?:歐陽|司馬|上官|諸葛|司徒|夏侯|令狐|皇甫|陳|林|黃|張|李|王|吳|劉|蔡|楊|許|鄭|謝|郭|洪|邱|曾|廖|賴|徐|周|葉|蘇|莊|呂|江|何|蕭|羅|高|潘|簡|朱|鍾|游|彭|詹|胡|施|沈|余|盧|梁|趙|顏|柯|孫|魏|翁|戴|范|宋|方|杜|姚|康|汪|白|田|丁|唐|馬|董|溫|石|蔣|卓|古|紀|連|歐|官|程|金|曹|阮|章|尹|袁|倪|殷|易|嚴|龔|龍|萬|段|文|傅|馮|任|于|夏|賀)/;
 const person=(value,explicit=false)=>{
  const s=value.trim();if(!s||org.test(s)||job.test(s)||/@|https?:|www\.|\d|[=<>()[\]{}]/i.test(s))return false;
  if(/^[\p{Script=Han}]{2,4}$/u.test(s))return surname.test(s);
  const words=s.replace(/^(?:Dr|Mr|Ms|Mrs)\.?\s+/i,'').split(/\s+/);
  return words.length>=2&&words.length<=4&&words.every(w=>/^[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)*$/.test(w)||(explicit&&/^[A-Z][A-Z'-]{1,}$/.test(w)));
 };
 function parse(text){
  const lines=String(text||'').normalize('NFKC').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const email=lines.join('\n').match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0]||'';
  const phones=lines.filter(s=>!/@|傳真|fax/i.test(s)).map(s=>({line:s,value:s.match(/(?:\+?\d[\d() -]{7,}\d)/)?.[0]||''})).filter(p=>p.value);
  const phone=phones.find(p=>/手機|電話|tel|mobile|phone/i.test(p.line))?.value||phones[0]?.value||'';
  let company='';const names=[];
  for(const line of lines){
   const explicit=line.match(/^(?:公司(?:名稱)?|組織|Company|Organization)\s*[:：]\s*(.+)$/i);if(explicit&&!company)company=explicit[1].trim();
  }
  if(!company)company=lines.find(s=>!/@|https?:|www\./i.test(s)&&org.test(s))||'';
  if(!company)company=lines.find(s=>/^[A-Z][A-Z0-9 .&()=+_-]{2,35}$/.test(s)&&!job.test(s)&&/[A-Z]{3}/.test(s))||'';
  for(const line of lines){
   const labeled=line.match(/^(?:姓名|名字|Name|Contact(?: person)?)\s*[:：]\s*(.+)$/i);
   if(labeled){const name=labeled[1].trim();if(person(name,true))names.push({name,score:100});continue;}
   if(line===company||org.test(line)||/@|https?:|www\./i.test(line))continue;
   if(person(line)&&(/[\p{Script=Han}]/u.test(line)||company||lines.some(s=>job.test(s))))names.push({name:line,score:60});
   else if(job.test(line)){
    const cleaned=line.replace(/總經理|副總|經理|總監|主任|工程師|業務|醫師|教授|董事|執行長|專員|顧問|\b(?:Manager|Director|Engineer|Consultant|Sales|CEO|CTO|President|Professor)\b/gi,'').replace(/^[\s:：|,，-]+|[\s:：|,，-]+$/g,'');
    if(person(cleaned,true))names.push({name:cleaned,score:65});
   }
  }
  const best=Math.max(0,...names.map(x=>x.score)),candidates=[...new Set(names.filter(x=>x.score===best).map(x=>x.name))],name=candidates.length===1?candidates[0]:'';
  const notice=name?'姓名與公司為規則擷取候選，請對照原名片確認。':candidates.length>1?'找到多個姓名候選，已留空；請對照原名片填寫。':'未找到可靠姓名，已留空；品牌／公司不會直接當成人名，請對照原名片填寫。';
  return {name,company,phone,email,notice};
 }
 // Compare normalized boxes; three stable observations are needed for a green guide.
 function stable(previous,next){return !!(previous&&next&&['x','y','width','height'].every(k=>Number.isFinite(previous[k])&&Number.isFinite(next[k])&&Math.abs(previous[k]-next[k])<.025));}
 function contain(vw,vh,width,height){if(!vw||!vh||!width||!height)return{x:0,y:0,width:0,height:0};const scale=Math.min(width/vw,height/vh);return{x:(width-vw*scale)/2,y:(height-vh*scale)/2,width:vw*scale,height:vh*scale};}
 const api={parse,stable,contain};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SmartScanCardTools=api;
})(typeof window!=='undefined'?window:globalThis);
