// Opt-in bounded smoke check. Reads a locally supplied env file; never logs or persists its key.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
if(!process.env.KU_ENV_FILE)throw Error('KU_ENV_FILE must point to an existing private env file.');
const raw=await fs.readFile(process.env.KU_ENV_FILE,'utf8');
const match=raw.match(/^KU_API_KEY\s*=\s*(.+)$/m);const key=(match?.[1]||'').trim().replace(/^(['"])(.*)\1$/,'$2');
if(!key)throw Error('No locally configured key.');
const source=await fs.readFile('lib/browser-client.mjs','utf8'),code=await fs.readFile('public/starter.py','utf8');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try {
 const page=await browser.newPage();await page.goto(process.env.BASE_URL||'http://127.0.0.1:5173');
 const outcome=await page.evaluate(async({source,code,key})=>{
  const {runEvaluation}=await import(URL.createObjectURL(new Blob([source],{type:'text/javascript'})));
  const config=await fetch('/api/config').then(r=>r.json());const suite=await fetch('/api/suite').then(r=>r.json());
  const result=await runEvaluation({code,cases:suite.cases.slice(0,1),key,config}).promise;
  return {status:result.status,elapsed:result.elapsed,cases:result.cases.map(({id,status,modelCalls,toolCalls,checks,error})=>({id,status,modelCalls,toolCalls,checks,error}))};
 },{source,code,key});
 console.log(JSON.stringify(outcome));assert.equal(outcome.status,'completed');assert.equal(outcome.cases[0].status,'pass');assert.ok(outcome.cases[0].modelCalls>0);
}finally{await browser.close();}
