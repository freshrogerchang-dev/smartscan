"use strict";
(function (root) {
  const categories = { document: "文件", receipt: "收據", card: "名片", other: "其他" };
  function pdfText(value) {
    return String(value || "").normalize("NFC").replace(/([\u2e80-\u9fff\u3040-\u30ff])[\t ]+(?=[\u2e80-\u9fff\u3040-\u30ff])/g,"$1");
  }
  function classify(text, mode) {
    text=pdfText(text);
    if (mode === "card") return "card";
    if (/收據|發票|領収|レシート|receipt|invoice|subtotal|total\s*[:：]?\s*[\d$¥]/i.test(text)) return "receipt";
    if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text) && /(?:tel|電話|手機|\+\d[\d ()-]{7})/i.test(text)) return "card";
    return "document";
  }
  function safeName(value) {
    return String(value || "").normalize("NFC").replace(/[\x00-\x1f\x7f\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").replace(/[. ]+$/g, "").slice(0, 100) || "SmartScan";
  }
  function suggest(text, sourceName, mode, now = new Date()) {
    const category = classify(text, mode);
    let date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    const match = text.match(/(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})/);
    if (match) {
      const [y,m,d] = match.slice(1).map(Number), parsed = new Date(y,m-1,d);
      if (parsed.getFullYear() === y && parsed.getMonth() === m-1 && parsed.getDate() === d) date = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    }
    const line = pdfText(text).split(/\r?\n/).map(x => x.trim()).find(Boolean) || String(sourceName || "掃描").replace(/\.[^.]+$/, "");
    return { category, name: safeName(`${date}_${categories[category]}_${Array.from(line).slice(0,24).join("")}`) };
  }
  const searchText = text => String(text || "").normalize("NFKC").toLocaleLowerCase().replace(/\s+/g," ").trim();
  function matches(record, query, category = "all") {
    const haystack = searchText(`${record.name}\n${categories[record.category] || ""}\n${record.text}\n${(record.tags||[]).join(" ")}`);
    return (category === "all" || record.category === category) && searchText(query).split(" ").every(word => haystack.includes(word) || (/[\u2e80-\u9fff\u3040-\u30ff]/.test(word) && haystack.replace(/\s/g,"").includes(word.replace(/\s/g,""))));
  }
  // Conservative connected light-region bounds. No perspective correction or assumed success.
  function detectBounds({ data, width, height }) {
    if (!width || !height || data.length !== width * height * 4) return null;
    const border = [];
    const luminance = i => .2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
    for(let x=0;x<width;x++){border.push(luminance(x*4));border.push(luminance(((height-1)*width+x)*4));}
    for(let y=0;y<height;y++){border.push(luminance(y*width*4));border.push(luminance((y*width+width-1)*4));}
    border.sort((a,b)=>a-b);
    const background = border[Math.floor(border.length/2)], threshold = Math.min(245,Math.max(170,background+25));
    const visited = new Uint8Array(width*height), queue = new Int32Array(width*height);
    let best = null;
    for(let start=0;start<visited.length;start++) {
      if(visited[start])continue;visited[start]=1;
      if(luminance(start*4)<threshold)continue;
      let head=0,tail=1,count=0,left=width,top=height,right=0,bottom=0;queue[0]=start;
      while(head<tail) {
        const pos=queue[head++],x=pos%width,y=Math.floor(pos/width);count++;
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        for(const next of [x>0?pos-1:-1,x<width-1?pos+1:-1,y>0?pos-width:-1,y<height-1?pos+width:-1]) {
          if(next<0||visited[next])continue;visited[next]=1;
          if(luminance(next*4)>=threshold)queue[tail++]=next;
        }
      }
      if(!best||count>best.count)best={count,left,right,top,bottom};
    }
    if(!best)return null;
    const w=best.right-best.left+1,h=best.bottom-best.top+1,area=w*h/(width*height);
    if(area<.12||area>.94||w/width<.2||h/height<.2||best.count/(w*h)<.45)return null;
    const pad=3;
    const x=Math.max(0,best.left-pad)/width,y=Math.max(0,best.top-pad)/height;
    return {x,y,width:Math.min(1,(best.right+pad+1)/width)-x,height:Math.min(1,(best.bottom+pad+1)/height)-y};
  }
  const api = { categories, classify, safeName, suggest, searchText, matches, detectBounds, pdfText };
  if(typeof module !== "undefined" && module.exports)module.exports=api;
  else root.SmartScanTools=api;
})(typeof window !== "undefined" ? window : globalThis);
