"use strict";
(function(root){
  const fields=["name","company","phone","email"];
  const normalize=value=>String(value||"").normalize("NFKC").trim();
  const phone=value=>normalize(value).replace(/[^\d+]/g,"").replace(/^00/,"+");
  function duplicate(a,b){
    const email=normalize(a.email).toLowerCase();
    if(email && email===normalize(b.email).toLowerCase())return "Email 相同";
    const tel=phone(a.phone);
    if(tel.length>=7 && tel===phone(b.phone))return "電話相同";
    return "";
  }
  function mergeContact(current,saved,choices){
    return Object.fromEntries(fields.map(key=>[key,normalize(choices[key]==="saved"?saved[key]:current[key])]));
  }
  function validDate(y,m,d){
    const date=new Date(Date.UTC(y,m-1,d));
    return date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d;
  }
  function receipt(text){
    const normalized=normalize(text),dates=[],amounts=[];
    for(const match of normalized.matchAll(/\b(20\d{2})\s*(?:年|[/.\-])\s*(\d{1,2})\s*(?:月|[/.\-])\s*(\d{1,2})(?:日)?/g)){
      const [,y,m,d]=match;
      if(validDate(+y,+m,+d))dates.push(`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`);
    }
    for(const line of normalized.split(/\r?\n/)){
      if(/subtotal|小計|税額|稅額|找零|change/i.test(line))continue;
      if(!/grand\s*total|total|合\s*計|總\s*[計額]|應\s*付|實\s*付/i.test(line))continue;
      const label=/grand\s*total|total|合\s*計|總\s*[計額]|應\s*付|實\s*付/i.exec(line);
      const tail=line.slice(label.index+label[0].length);
      const matches=[...tail.matchAll(/(?:^|[^\d.,])(-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|-?\d+(?:\.\d{1,2})?)(?![\d.,])/g)];
      if(matches.length!==1)continue;
      const value=Number(matches[0][1].replace(/,/g,""));
      if(!Number.isFinite(value)||value<0)continue;
      const currency=/NT\$|TWD|新台幣/i.test(line)?"TWD":/JPY|¥|円/.test(line)?"JPY":/USD|US\$/i.test(line)?"USD":"";
      amounts.push({amount:String(value),currency,evidence:line.trim()});
    }
    const unique=[...new Map(amounts.map(item=>[item.amount+"|"+item.currency,item])).values()];
    const ds=[...new Set(dates)];
    return {date:ds.length===1?ds[0]:"",amount:unique.length===1?unique[0].amount:"",currency:unique.length===1?unique[0].currency:"",dates:ds,amounts:unique};
  }
  const profiles={balanced:{edge:2400,quality:.85,label:"清晰"},compact:{edge:1600,quality:.68,label:"輕量"},small:{edge:1200,quality:.5,label:"最小"}};
  function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
  // ZIP STORE wraps already-compressed JPEGs; UTF-8 names, no external service.
  function zip(entries){
    const encoder=new TextEncoder(),parts=[],central=[];let offset=0;
    function header(size){const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)};}
    for(const entry of entries){
      const name=encoder.encode(entry.name),data=entry.data,crc=crc32(data),local=header(30);
      local.view.setUint32(0,0x04034b50,true);local.view.setUint16(4,20,true);local.view.setUint16(6,0x800,true);
      local.view.setUint16(12,33,true);local.view.setUint32(14,crc,true);local.view.setUint32(18,data.length,true);local.view.setUint32(22,data.length,true);local.view.setUint16(26,name.length,true);
      parts.push(local.bytes,name,data);
      const c=header(46);c.view.setUint32(0,0x02014b50,true);c.view.setUint16(4,20,true);c.view.setUint16(6,20,true);c.view.setUint16(8,0x800,true);c.view.setUint16(14,33,true);
      c.view.setUint32(16,crc,true);c.view.setUint32(20,data.length,true);c.view.setUint32(24,data.length,true);c.view.setUint16(28,name.length,true);c.view.setUint32(42,offset,true);
      central.push(c.bytes,name);offset+=30+name.length+data.length;
    }
    const size=central.reduce((n,b)=>n+b.length,0),end=header(22);
    end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,entries.length,true);end.view.setUint16(10,entries.length,true);end.view.setUint32(12,size,true);end.view.setUint32(16,offset,true);
    return new Blob([...parts,...central,end.bytes],{type:"application/zip"});
  }
  const api={fields,duplicate,mergeContact,receipt,profiles,zip,crc32};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.SmartScanProductivity=api;
})(globalThis);
