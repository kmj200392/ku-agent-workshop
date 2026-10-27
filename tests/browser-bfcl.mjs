import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage();await page.goto(process.env.BASE_URL||'http://127.0.0.1:5173');
 const source=await fs.readFile('lib/browser-client.mjs','utf8');
 const items=JSON.parse(execFileSync('python3',['-c',"import sys,json; sys.path.insert(0,'tests'); from bfcl_test import SUITES,oracle; print(json.dumps([{**x,'oracle':oracle(x)} for x in SUITES['practice']+SUITES['final']]))"],{encoding:'utf8'}));
 const output=await page.evaluate(async({source,items})=>{
  const {runEvaluation}=await import(URL.createObjectURL(new Blob([source],{type:'text/javascript'})));
  const config=await fetch('/api/config').then(r=>r.json());const records=[];
  for(const {oracle,...test} of items){
   const literal=JSON.stringify(JSON.stringify(oracle));
   const code=`import json\nPLAN = json.loads(${literal})\nseen = 0\nasync def agent(task, api):\n    global seen\n    assert seen == task['turn']\n    seen += 1\n    for call in PLAN[task['turn']]:\n        await api.tool(call['name'], call['arguments'])\n    return 'Oracle replay only'\n`;
   const r=await runEvaluation({code,cases:[test],key:'',config}).promise;
   records.push({id:test.id,status:r.cases[0]?.status,error:r.cases[0]?.error});
  }
  // A budget violation is an algorithmic failure; runtime/transport failure is incomplete.
  const runaway=`async def agent(task, api):\n    for _ in range(30):\n        await api.tool('list_all_airports', {})\n    return 'done'`;
  const limited=await runEvaluation({code:runaway,cases:[items[0]],key:'',config}).promise;
  return {records,limited:{status:limited.status,caseStatus:limited.cases[0].status,error:limited.cases[0].error}};
 },{source,items});
 console.log(JSON.stringify(output));assert.ok(output.records.every(x=>x.status==='pass'));assert.equal(output.limited.status,'completed');assert.equal(output.limited.caseStatus,'fail');
 await page.getByRole('button',{name:'과제 · 사용 가이드',exact:true}).click();
 await page.getByRole('heading',{name:'벤치마크 출처와 범위',exact:true}).waitFor();
 await page.screenshot({path:'outputs/bfcl-guide-desktop.png',fullPage:true});
}finally{await browser.close();}
