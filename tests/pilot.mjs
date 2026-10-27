// Opt-in bounded pilot. Credentials are read only from an existing private env file.
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
if(!process.env.KU_ENV_FILE)throw Error('Set KU_ENV_FILE to an existing private env file');
const raw=await fs.readFile(process.env.KU_ENV_FILE,'utf8');
const key=(raw.match(/^KU_API_KEY\s*=\s*(.+)$/m)?.[1]||'').trim().replace(/^(['"])(.*)\1$/,'$2');
if(!key)throw Error('No key configured');
const starter=await fs.readFile('public/starter.py','utf8');
const variants=[
 ['no_memory',starter.replace('    history.extend(task["messages"])','    history = [{"role": "system", "content": SYSTEM}]\n    history.extend(task["messages"])')],
 ['starter',starter],
 ['guided',starter.replace('Complete the current user request using only the currently available tools.','Complete the current user request using only the currently available tools.\nBefore acting, identify all required inputs, tools and prior facts. Call independent\nread-only tools together where useful. Use values from tool results rather than\nrecalculating or guessing them. Preserve the user\'s dates, currency and card choice.\nIf the requested operation is impossible, explain it without preparatory tool calls.')],
];
const source=await fs.readFile('lib/browser-client.mjs','utf8');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
let calls=0;const summaries=[];
try{
 const page=await browser.newPage();await page.goto(process.env.BASE_URL||'http://127.0.0.1:5173');
 await page.exposeFunction('pilotProgress',d=>console.log(JSON.stringify(d)));
 for(const [name,code] of variants){
  const result=await page.evaluate(async({source,code,key,name,remaining})=>{
   const {runEvaluation}=await import(URL.createObjectURL(new Blob([source],{type:'text/javascript'})));
   const config=await fetch('/api/config').then(r=>r.json()),suite=await fetch('/api/suite').then(r=>r.json());
   const selected=name==='starter'?suite.cases:suite.cases.filter(x=>['multi_turn_base_150','multi_turn_miss_param_150','multi_turn_base_155'].includes(x.id));
   let used=0;let job;
   job=runEvaluation({code,cases:selected,key,config,onEvent:e=>{
    if(e.kind==='model-input'&&++used>remaining)job.abort();
    if(e.kind==='case-end')window.pilotProgress({variant:name,id:e.record.id,status:e.record.status,modelCalls:e.record.modelCalls,elapsed:e.record.elapsed});
   }});
   return await job.promise;
  },{source,code,key,name,remaining:120-calls});
  const used=result.cases.reduce((n,x)=>n+x.modelCalls,0);calls+=used;
  const summary={name,status:result.status,passed:result.cases.filter(x=>x.status==='pass').length,total:result.cases.length,modelCalls:used,elapsed:result.elapsed,cases:result.cases.map(({id,status,checks,error})=>({id,status,checks,error}))};
  summaries.push(summary);await fs.writeFile(`outputs/pilot-${name}.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(summary));
  if(result.status!=='completed'||calls>=120)break;
 }
 await fs.writeFile('outputs/pilot-summary.json',JSON.stringify({model:'claude-haiku-5-5',calls,summaries},null,2));
}finally{await browser.close();}
