import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function normalize(text, compact=false) {
  const value=text.normalize('NFC').replace(/\r\n?/g,'\n').trim();
  return compact ? value.replace(/\s/gu,'') : value;
}
export function score(reference, hypothesis, compact=false) {
  const a=Array.from(normalize(reference,compact)), b=Array.from(normalize(hypothesis,compact));
  if (!a.length) throw Error('Empty reference is not scoreable');
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++) {
    const next=[i];
    for(let j=1;j<=b.length;j++) next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));
    row=next;
  }
  const edits=row[b.length];
  return {edits,reference_chars:a.length,cer:edits/a.length};
}
export function evaluate(manifest, hypotheses) {
  if(!Array.isArray(manifest)||!manifest.length||!Array.isArray(hypotheses))throw Error('Expected nonempty manifest and hypotheses arrays');
  const expected=new Set(manifest.map(x=>x.id)), actual=new Set(hypotheses.map(x=>x.id));
  if(expected.size!==manifest.length||actual.size!==hypotheses.length)throw Error('Duplicate sample IDs');
  const missing=[...expected].filter(id=>!actual.has(id)),unknown=[...actual].filter(id=>!expected.has(id));
  if(missing.length||unknown.length)throw Error(`ID mismatch: missing=${missing.join(',')}; unknown=${unknown.join(',')}`);
  const byId=new Map(hypotheses.map(x=>[x.id,x]));
  const rows=manifest.map(sample=>{
    const h=byId.get(sample.id);
    if(typeof sample.reference_text!=='string'||typeof h.text!=='string')throw Error(`Text must be string: ${sample.id}`);
    return {id:sample.id,language:sample.language,condition:sample.condition,strict:score(sample.reference_text,h.text),compact:score(sample.reference_text,h.text,true)};
  });
  function aggregate(items,key) {
    const edits=items.reduce((n,r)=>n+r[key].edits,0),reference_chars=items.reduce((n,r)=>n+r[key].reference_chars,0);
    return {samples:items.length,edits,reference_chars,cer:edits/reference_chars};
  }
  return {rows,strict:aggregate(rows,'strict'),compact:aggregate(rows,'compact'),by_language:Object.fromEntries([...new Set(rows.map(r=>r.language))].map(k=>[k,aggregate(rows.filter(r=>r.language===k),'compact')])),by_condition:Object.fromEntries([...new Set(rows.map(r=>r.condition))].map(k=>[k,aggregate(rows.filter(r=>r.condition===k),'compact')]))};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const [manifestPath,hypothesesPath]=process.argv.slice(2);
    if(!manifestPath||!hypothesesPath)throw Error('Usage: node sim/score-ocr.mjs MANIFEST.json HYPOTHESES.json');
    console.log(JSON.stringify(evaluate(JSON.parse(await readFile(manifestPath,'utf8')),JSON.parse(await readFile(hypothesesPath,'utf8'))),null,2));
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
