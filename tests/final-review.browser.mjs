import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm,readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const suites=JSON.parse(await readFile('lib/bfcl-suites.json','utf8'));
const temp=await mkdtemp(join(tmpdir(),'ku-final-review-'));
const env={...process.env,TURSO_DATABASE_URL:'file:'+join(temp,'test.db'),NODE_ENV:'production'};
assert.equal(spawnSync(process.execPath,['scripts/migrate.mjs'],{env,encoding:'utf8'}).status,0);
const base='http://127.0.0.1:3113',storageKey='ku-agent:bfcl-travel-v2:last-result';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3113','-H','127.0.0.1'],{env,stdio:['ignore','pipe','pipe']});let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 for(let n=0;n<100;n++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const config=await (await fetch(base+'/api/config')).json();
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],modelCalls=[],writes=[];
 let phase='final',finalGets=0,suiteUnavailable=false;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/https:\/\/api\.(baze\.co|openai\.com)\//,r=>{modelCalls.push(r.request().url());return r.abort();});
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),action=url.pathname.split('/').at(-1);
  if(req.method()==='POST')writes.push({action,body:req.postDataJSON()});
  if(action==='config')return route.fulfill({json:{...config,phase,signedIn:true,isInstructor:false}});
  if(action==='me')return route.fulfill({json:{participant:{nickname:'로컬 검증'},runs:[]}});
  if(action==='suite'&&url.searchParams.get('kind')==='final'){
   finalGets++;return suiteUnavailable?route.fulfill({status:503,json:{error:'문제 로드 실패 테스트'}}):route.fulfill({json:{version:config.finalVersion,cases:suites.final}});
  }
  if(action==='final-start')return route.fulfill({json:{runId:'fixture-final',hash:'fixture-code',suite:config.finalVersion,provider:'school',model:config.model,status:'running',code:'async def agent(task, api):\n    return "No actions: local review test"'}});
  if(action==='finish')return route.fulfill({json:{saved:true,score:0}});
  if(req.method()==='POST')throw Error('Unexpected write: '+action);
  return route.continue();
 });
 const button=name=>page.getByRole('button',{name,exact:true});
 await page.goto(base+'/agents#intro/llm-key');
 await button('API 및 참가 설정').click();await page.locator('#api-key').fill('fixture-no-inference');await button('설정 완료').click();
 await button('워크스페이스').click();
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)||'null')?.uploaded,storageKey,{timeout:180000});
 const completed=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
 assert.equal(completed.status,'completed');assert.equal(completed.kind,'final');assert.equal(completed.cases.length,30);assert.equal(completed.reviewCases.length,30);
 assert(completed.reviewCases.every(c=>Object.keys(c).sort().join(',')==='entry,ground_truth,id'));
 assert.equal(writes.filter(r=>r.action==='final-start').length,1);assert.equal(writes.filter(r=>r.action==='finish').length,1);
 assert(!JSON.stringify(writes).includes('ground_truth'));assert(!JSON.stringify(writes).includes('fixture-no-inference'));
 await page.getByText('최종 30문항 평가 완료',{exact:true}).waitFor();
 assert.equal(await page.locator('.case-heading').count(),30);
 await page.locator('.case-heading').first().click();
 const review=page.getByRole('region',{name:'최종 문제 피드백'});
 await review.getByText('1턴에서 처음 실패했어요',{exact:true}).waitFor();
 await review.getByRole('heading',{name:'기대하는 동작'}).first().waitFor();
 await review.getByRole('heading',{name:'실제 실행'}).first().waitFor();
 assert.equal(await review.locator('.feedback-turn.first-failure[open]').count(),1);
 const postsAfterRun=writes.length,getsAfterRun=finalGets;
 await button('리더보드').click();await button('워크스페이스').click();await review.waitFor();
 phase='closed';suiteUnavailable=true;await page.reload();await page.locator('.case-heading').first().click();await review.waitFor();assert.equal(finalGets,getsAfterRun);
 await button('API 및 참가 설정').click();assert.equal(await page.locator('#api-key').inputValue(),'');await button('설정 완료').click();
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await mkdir('outputs/final-review',{recursive:true});await page.locator('.result-panel').screenshot({path:'outputs/final-review/mobile.png'});
 await page.setViewportSize({width:1440,height:1000});await page.locator('.result-panel').screenshot({path:'outputs/final-review/desktop.png'});
 // Legacy completed results can recover matching review data without rerunning the agent.
 const legacy={...completed};delete legacy.reviewCases;
 await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:storageKey,value:legacy});await page.reload();
 await page.getByText('문제 로드 실패 테스트',{exact:true}).waitFor();suiteUnavailable=false;await button('해설 다시 불러오기').click();
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).reviewCases?.length===30,storageKey);await page.locator('.case-heading').first().click();await review.waitFor();
 // Never match an older suite to new references, nor show final explanations on an interrupted run.
 for(const value of [{...legacy,suite:'old-version'},{...completed,status:'aborted'}]){
  const before=finalGets;await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:storageKey,value});await page.reload();await page.locator('.case-heading').first().click();
  assert.equal(await review.count(),0);assert.equal(finalGets,before);
  await page.getByText('채점 기록 원문',{exact:true}).click();
 }
 // Practice still uses the released practice suite and its existing feedback labels.
 const first=suites.practice[0],practice={...legacy,kind:'practice',suite:config.practiceVersion,total:1,cases:[{id:first.id,label:first.label,title:first.title,status:'fail',elapsed:1,modelCalls:0,toolCalls:0,checks:[{pass:false,error:'multi_turn:empty_turn_model_response'}],trace:[],answer:['No actions']}]};
 await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:storageKey,value:practice});await page.reload();await page.locator('.case-heading').first().click();await page.getByRole('region',{name:'연습 문제 피드백'}).waitFor();
 assert.equal(writes.length,postsAfterRun);assert.equal(modelCalls.length,0);assert.deepEqual(errors,[]);
 console.log('PASS: real Python final30 without model calls; per-turn review, snapshot persistence, reload without final fetch, old-result recovery/retry, version and incomplete guards, practice regression, mobile layout; no real database writes.');
}catch(e){console.error(logs);throw e;}finally{await browser.close();server.kill('SIGTERM');await new Promise(r=>server.on('exit',r));await rm(temp,{recursive:true,force:true});}
