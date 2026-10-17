import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const output = fileURLToPath(new URL('../data/sample/generated/', import.meta.url));
await mkdir(output, { recursive: true });
const samples = [
  { id:'eng', language:'eng', lines:['SMARTSCAN TEST','Invoice 12345','Total 100.00'] },
  { id:'chi-tra', language:'chi_tra+eng', lines:['智慧掃描測試','這是自行製作的測試文件。','日期：2026 年 10 月 17 日'] },
  { id:'jpn', language:'jpn+eng', lines:['スマートスキャン','これはテストです。','合計 100 円'] },
  { id:'card', language:'eng', lines:['Sample Person','Example Company','+1 202-555-0100','hello@example.com'], fields:{name:'Sample Person',company:'Example Company',phone:'+1 202-555-0100',email:'hello@example.com'} }
];
const escape = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const manifest = [];
for (const sample of samples) for (const condition of ['clean','rotate90','skew5','shadow']) {
  const id = `${sample.id}-${condition}`;
  const rotation = condition==='rotate90' ? 90 : condition==='skew5' ? 5 : 0;
  const lines=sample.lines.map((s,i)=>`<text x="260" y="${390+i*85}">${escape(s)}</text>`).join('\n');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600" viewBox="0 0 1600 1600">
<defs><linearGradient id="shadow"><stop stop-color="black" stop-opacity="0.55"/><stop offset="1" stop-color="black" stop-opacity="0"/></linearGradient></defs>
<rect width="1600" height="1600" fill="white"/>
<g transform="rotate(${rotation} 800 800)" font-family="Arial, 'Microsoft JhengHei', 'Yu Gothic', sans-serif" font-size="44" fill="black">${lines}</g>
${condition==='shadow'?'<rect width="1600" height="1600" fill="url(#shadow)"/>':''}
</svg>\n`;
  await writeFile(join(output,`${id}.svg`),svg);
  manifest.push({id,language:sample.language,condition,image:`${id}.svg`,reference_text:sample.lines.join('\n'),fields:sample.fields??null,source:'self-authored-synthetic',recommended_manual_rotation:condition==='rotate90'?270:0});
}
await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Generated ${manifest.length} SVG samples and manifest.json`);
