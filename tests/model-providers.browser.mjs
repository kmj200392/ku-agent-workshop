import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const temp=await mkdtemp(join(tmpdir(),'ku-provider-browser-'));
const env={...process.env,TURSO_DATABASE_URL:'file:'+join(temp,'test.db'),NODE_ENV:'production'};
assert.equal(spawnSync(process.execPath,['scripts/migrate.mjs'],{env,encoding:'utf8'}).status,0);
const base='http://127.0.0.1:3108';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3108','-H','127.0.0.1'],{env,stdio:['ignore','pipe','pipe']});let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const errors=[],requests=[],uploads=[];
try{
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url().startsWith(base+'/api/')&&r.method()==='POST')uploads.push(r.postData());});
 for(const [provider,url] of [['school','https://api.baze.co/**'],['openai','https://api.openai.com/**']])await page.route(url,async route=>{
  const r=route.request();if(r.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type'}});return;}
  const payload=r.postDataJSON();assert.equal(r.headers().authorization,'Bearer fixture-'+provider);
  assert.equal(payload.model,'gpt-6-luna');
  assert.equal(payload.reasoning_effort,'none');assert.equal(payload.max_completion_tokens,2048);assert(!('max_tokens' in payload));
  requests.push(provider);
  const reply=payload.tools?.length&&!payload.messages.some(m=>m.role==='tool')?{role:'assistant',content:null,tool_calls:[{id:'call_fixture',type:'function',function:{name:'search_events',arguments:'{"query":"Python"}'}}]}:{role:'assistant',content:'Fixture completed'};
  await route.fulfill({json:{choices:[{message:reply}]},headers:{'access-control-allow-origin':'*'}});
 });
 const button=name=>page.getByRole('button',{name,exact:true});
 await page.goto(base+'/agents#lesson/agent-loop');
 await button('API 및 참가 설정').click();
 await button('OpenAI API').click();await page.locator('#api-key').fill('fixture-openai');
 await button('고려대학교 API').click();assert.equal(await page.locator('#api-key').inputValue(),'');
 await button('OpenAI API').click();assert.equal(await page.locator('#api-key').inputValue(),'fixture-openai');
 await page.getByLabel('리더보드에 표시할 이름',{exact:true}).fill('제공자 검증');await button('참가 코드 발급').click();await page.getByText('개인 참가 코드를 보관해주세요',{exact:true}).waitFor();
 await button('설정 완료').click();await button('실행하기').click();await page.getByText('실행 완료 · 다른 페이지로 이동해도 유지됩니다.',{exact:true}).waitFor();
 assert(requests.length>=2);assert(requests.every(p=>p==='openai'));
 let result=await page.evaluate(()=>JSON.parse(localStorage.getItem('ku-agent:demo:live:D06')));assert.equal(result.provider,'openai');assert.equal(result.model,'gpt-6-luna');assert(result.events.some(e=>e.kind==='tool'));
 // A real Python worker must also use OpenAI when the school key is empty.
 await button('워크스페이스').click();
 await page.getByLabel('에이전트 Python 코드',{exact:true}).fill('async def agent(task, api):\n    reply = await api.chat([{"role": "user", "content": "Say done"}], [])\n    return reply["content"]');
 await button('제출하고 평가').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('ku-agent:bfcl-travel-v2:last-result')||'null')?.uploaded,undefined,{timeout:180000});
 result=await page.evaluate(()=>JSON.parse(localStorage.getItem('ku-agent:bfcl-travel-v2:last-result')));
 assert.equal(result.status,'completed',JSON.stringify(result.cases.map(c=>c.error)));assert.equal(result.cases.length,12);assert.equal(result.provider,'openai');assert.equal(result.model,'gpt-6-luna');
 const board=await page.evaluate(()=>fetch('/api/leaderboard').then(r=>r.json()));assert.equal(board.entries[0].provider,'openai');assert.equal(board.entries[0].model,'gpt-6-luna');
 const persisted=await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));assert(!persisted.includes('fixture-openai'));assert(uploads.every(x=>!x?.includes('fixture-openai')));
 await page.reload();await button('API 및 참가 설정').click();assert.equal(await page.locator('#api-key').inputValue(),'');
 await button('고려대학교 API').click();assert.equal(await page.locator('#api-key').inputValue(),'');await page.locator('#api-key').fill('fixture-school');
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mkdir('outputs/providers',{recursive:true});await page.screenshot({path:'outputs/providers/settings-mobile.png'});
 await button('설정 완료').click();await page.goto(base+'/agents#lesson/agent-loop');
 await button('다시 실행').click();await page.getByText('실행 완료 · 다른 페이지로 이동해도 유지됩니다.',{exact:true}).waitFor();
 result=await page.evaluate(()=>JSON.parse(localStorage.getItem('ku-agent:demo:live:D06')));assert.equal(result.provider,'school');assert.equal(result.model,'gpt-6-luna');assert(requests.includes('school'));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'passed',openaiOnlyDemo:true,schoolOnlyDemo:true,pythonWorkerEvaluation:true,modelOnLeaderboard:true,keysClearedOnReload:true,noKeysPersistedOrUploaded:true,fixtureRequests:requests.length,pageErrors:errors}));
}catch(e){console.error(logs);throw e;}finally{await browser.close();server.kill('SIGTERM');await new Promise(r=>server.on('exit',r));await rm(temp,{recursive:true,force:true});}
