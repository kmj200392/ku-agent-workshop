// Local-only final-window integration; restores the original config even on failure.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:5173';
if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base))throw Error('Local development only');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const configPath=new URL('../lib/config.ts',import.meta.url),original=await fs.readFile(configPath,'utf8');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage();await page.goto(base+'/signin-with-chatgpt?return_to=/');
 const before=await page.evaluate(()=>fetch('/api/me').then(r=>r.json()));assert.ok(before.runs.some(x=>x.status==='completed'&&x.kind==='practice'),'Run browser.mjs first');
 const freeze=new Date(Date.now()-1000).toISOString(),close=new Date(Date.now()+600000).toISOString();
 await fs.writeFile(configPath,original.replace(/freezeAt: '[^']+'/,'freezeAt: '+JSON.stringify(freeze)).replace(/closeAt: '[^']+'/,'closeAt: '+JSON.stringify(close)).replace(/finalVersion: '[^']+'/,'finalVersion: '+JSON.stringify('bfcl-final-test-'+Date.now())));
 let phaseReady=false;
 for(let attempt=0;attempt<100;attempt++){phaseReady=await page.evaluate(async()=>(await fetch('/api/config').then(r=>r.json())).phase==='final');if(phaseReady)break;await new Promise(r=>setTimeout(r,200));}
 assert.ok(phaseReady,'Final-window config did not reload');
 const source=await fs.readFile('lib/browser-client.mjs','utf8');
 const out=await page.evaluate(async source=>{
  const post=(p,b)=>fetch('/api/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(async r=>({status:r.status,data:await r.json()}));
  const start=await post('final-start',{});if(start.data.status==='completed')throw Error('Use a fresh local test final ID');
  const config=await fetch('/api/config').then(r=>r.json());const suite=await fetch('/api/suite?kind=final').then(async r=>({http:r.status,...await r.json()}));
  if(!suite.cases||!start.data.code)throw Error(JSON.stringify({start,config,suite}));
  const {runEvaluation,summaryForUpload}=await import(URL.createObjectURL(new Blob([source],{type:'text/javascript'})));
  const result=await runEvaluation({code:start.data.code,cases:suite.cases,key:'',config}).promise;
  const payload=summaryForUpload(start.data.runId,result),saved=await post('finish',payload);
  const repeat=await post('finish',{...payload,cases:payload.cases.map(x=>({...x,status:'pass'}))});
  const restarted=await post('final-start',{});
  const rejected=await post('submit',{requestId:crypto.randomUUID(),code:'async def agent(task, api): return "done"'});
  const board=await fetch('/api/leaderboard?kind=final').then(r=>r.json());
  return {result:result.status,cases:result.cases.length,score:result.cases.filter(x=>x.status==='pass').length,saved,repeat,restarted,rejected,board};
 },source);
 assert.equal(out.result,'completed');assert.equal(out.cases,20);assert.equal(out.saved.data.score,out.score);assert.equal(out.repeat.data.alreadySaved,true);assert.equal(out.repeat.data.score,out.score);assert.equal(out.restarted.data.status,'completed');assert.equal(out.rejected.status,409);assert.equal(out.board.entries[0].total,20);
 console.log(JSON.stringify({finalCount:out.cases,score:out.score,stored:true,immutable:true,repeatDoesNotRun:true,lateSubmissionRejected:true}));
}finally{await fs.writeFile(configPath,original);await browser.close();}
