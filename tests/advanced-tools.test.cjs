const {test}=require('node:test'),assert=require('node:assert/strict');const a=require('../public/advanced-tools.js');
test('events detect valid dates and same-line times without guessing relative dates',()=>{
 const result=a.events('Workshop 2026/10/20 14:00-15:30\nInvalid 2026-02-30\nTomorrow 9am\n假日 2026年10月21日');
 assert.equal(result.length,2);assert.deepEqual(result[0],{date:'2026-10-20',start:'14:00',end:'15:30',title:'Workshop',source:'Workshop 2026/10/20 14:00-15:30'});assert.equal(result[1].start,'');
});
test('ICS converts chosen Taipei wall time to UTC, escapes injection and folds UTF-8 lines',()=>{
 const result=a.ics({title:'測試'.repeat(30)+'\nATTENDEE:bad',start:'2026-10-20T14:00',end:'2026-10-20T15:30',zone:'Asia/Taipei',location:'A,B',description:'a;b'},'id',new Date('2026-10-17T00:00:00Z'));
 assert.match(result,/DTSTART:20261020T060000Z/);assert.match(result,/DTEND:20261020T073000Z/);assert.doesNotMatch(result,/\r\nATTENDEE:/);assert.match(result,/LOCATION:A\\,B/);
 for(const line of result.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
});
test('ICS rejects invalid dates, reversed times, unsupported zones and zero-length all-day',()=>{
 const e={title:'T',start:'2026-10-20T14:00',end:'2026-10-20T15:00',zone:'UTC'};
 for(const change of [{end:e.start},{start:'2026-02-30T14:00'},{zone:'Mars'},{start:'2026-10-20T25:00'}])assert.throws(()=>a.ics({...e,...change},'id'));
 assert.match(a.ics({...e,allDay:true,start:'2026-10-20',end:'2026-10-21'},'id'),/DTEND;VALUE=DATE:20261021/);
 assert.throws(()=>a.ics({...e,allDay:true,start:'2026-10-20',end:'2026-10-20'},'id'));
});
test('table supports TSV and quoted CSV, preserves empty cells and refuses oversized tables',()=>{
 assert.deepEqual(a.table('A\tB\n\t100','\t'),[['A','B'],['','100']]);
 assert.deepEqual(a.table('"Name, legal",Amount\n"A ""quoted""",100',','),[['Name, legal','Amount'],['A "quoted"','100']]);
 assert.throws(()=>a.table('"unfinished,100',','));assert.throws(()=>a.table(Array(201).fill('a,b').join('\n'),','));
});
test('geometry reconstructs aligned rows with a missing cell rather than shifting later columns',()=>{
 const word=(text,x,y)=>({text,bbox:{x0:x,x1:x+20,y0:y,y1:y+10}});
 assert.deepEqual(a.tableFromWords([word('A',10,10),word('B',120,10),word('C',240,10),word('1',10,30),word('3',240,30)]),[['A','B','C'],['1','','3']]);
});
test('CSV neutralizes formula prefixes and XLSX stores all cells as inline strings',()=>{
 const result=a.csv([['=SUM(A1)',' @cmd','-100','+1','normal','"quote"']]);assert.match(result,/"'=SUM\(A1\)"/);assert.match(result,/"' @cmd"/);
 const sheet=new TextDecoder().decode(a.xlsxEntries([['=1+1','<script>&"']]).find(x=>x.name.endsWith('sheet1.xml')).data);
 assert.match(sheet,/t="inlineStr"/);assert.doesNotMatch(sheet,/<f>/);assert.match(sheet,/&lt;script&gt;&amp;&quot;/);
});
test('AI prompts mark source as untrusted, request page citations and reject silent truncation',()=>{
 const prompt=a.readingPrompt('[P1]\nBudget 200','How much?');assert.match(prompt[0].content,/untrusted/);assert.match(prompt[0].content,/\[P1\]/);assert.equal(JSON.parse(prompt[1].content).document,'[P1]\nBudget 200');assert.throws(()=>a.readingPrompt('x'.repeat(12001),''));
 assert.deepEqual(a.modelOptions(true).expectedInputs.map(item=>item.type),['text','image']);
});
