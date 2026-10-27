import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const runtimeSource=await fs.readFile('lib/browser-client.mjs','utf8');const errors=[];const modelRequests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('api.baze.co'))modelRequests.push({url:r.url()});});
try{
 const base=process.env.BASE_URL||'http://127.0.0.1:5173';
 await page.goto(base);await page.getByRole('button',{name:'제출하고 평가',exact:true}).waitFor();
 const anon=await page.evaluate(async()=>{const r=await fetch('/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});return r.status;});assert.equal(anon,401);
 const hidden=await page.evaluate(async()=>(await fetch('/api/suite?kind=final')).status);assert.equal(hidden,403);
 await page.goto(base+'/signin-with-chatgpt?return_to=/');
 await page.getByRole('button',{name:'API 및 참가 설정',exact:true}).click();
 await page.getByLabel('리더보드에 표시할 이름',{exact:true}).fill('로컬 검증');
 await page.getByRole('button',{name:'이름 저장',exact:true}).click();
 await page.waitForFunction(()=>document.body.textContent.includes('참가 이름을 저장했습니다.'));
 await page.locator('#api-key').fill('local-test-no-api-calls');
 await page.getByRole('button',{name:'설정 완료',exact:true}).click();
 await page.getByLabel('에이전트 Python 코드',{exact:true}).fill(await fs.readFile('tests/reference_agent.py','utf8'));
 await page.getByRole('button',{name:'제출하고 평가',exact:true}).click();
 await page.getByRole('button',{name:'강의 시연',exact:true}).click();
 await page.getByRole('button',{name:'워크스페이스',exact:true}).click();
 await page.waitForFunction(()=>{const x=JSON.parse(localStorage.getItem('ku-agent:bfcl-travel-v1:last-result')||'null');return x?.uploaded;},undefined,{timeout:180000});
 const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('ku-agent:bfcl-travel-v1:last-result')));
 assert.equal(result.status,'completed',JSON.stringify(result.cases.map(c=>({id:c.id,status:c.status,error:c.error}))));assert.equal(result.cases.filter(c=>c.status==='pass').length,6);assert.equal(modelRequests.length,0);
 const idem=await page.evaluate(async({r,source})=>{const {summaryForUpload}=await import(URL.createObjectURL(new Blob([source],{type:'text/javascript'})));return fetch('/api/finish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(summaryForUpload(r.runId,r))}).then(r=>r.json());},{r:result,source:runtimeSource});assert.equal(idem.alreadySaved,true);
 await page.getByRole('button',{name:'리더보드',exact:true}).click();await page.getByRole('cell',{name:'로컬 검증',exact:true}).waitFor();await page.screenshot({path:'outputs/leaderboard-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'강의 시연',exact:true}).click();await page.getByRole('button',{name:'D10 RAG 검색',exact:true}).click();await page.getByRole('button',{name:'시연 실행',exact:true}).click();await page.getByText('실행 완료 · 다른 페이지로 이동해도 유지됩니다.',{exact:true}).waitFor();
 const d10=await page.evaluate(()=>localStorage.getItem('ku-agent:demo:live:D10'));
 await page.getByRole('button',{name:'워크스페이스',exact:true}).click();await page.getByRole('button',{name:'강의 시연',exact:true}).click();assert.equal(await page.evaluate(()=>localStorage.getItem('ku-agent:demo:live:D10')),d10);
 await page.reload();await page.getByText('저장된 결과 · 다시 실행하기 전까지 유지됩니다.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'API 및 참가 설정',exact:true}).click();assert.equal(await page.locator('#api-key').inputValue(),'');await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
 await page.getByRole('button',{name:'D08 MCP 발견',exact:true}).click();await page.getByRole('button',{name:'시연 실행',exact:true}).click();await page.getByText('실행 완료 · 다른 페이지로 이동해도 유지됩니다.',{exact:true}).waitFor();const d8=await page.evaluate(()=>JSON.parse(localStorage.getItem('ku-agent:demo:live:D08')));assert.ok(d8.events.some(e=>e.kind==='mcp_response'));
 await page.screenshot({path:'outputs/demos-desktop.png',fullPage:true});
 // Actual worker timeout and syntax errors must be incomplete, not rankable zero scores.
 const failures=await page.evaluate(async(source)=>{const {runEvaluation}=await import(URL.createObjectURL(new Blob([source],{type:'text/javascript'})));const c=await fetch('/api/config').then(r=>r.json());const s=await fetch('/api/suite').then(r=>r.json());const invalid=await runEvaluation({code:'invalid python !!!',cases:s.cases.slice(0,1),key:'',config:c}).promise;const hung=runEvaluation({code:'async def agent(task, api):\n    while True: pass',cases:s.cases.slice(0,1),key:'',config:{...c,limits:{...c.limits,caseMs:10000}}});const timeout=await hung.promise;return {invalid:invalid.status,timeout:timeout.status,error:timeout.cases[0]?.error};},runtimeSource);assert.equal(failures.invalid,'error');assert.equal(failures.timeout,'error');assert.match(failures.error,/시간 제한/);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'워크스페이스',exact:true}).click();await page.screenshot({path:'outputs/workspace-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:6,pythonWorker:true,serverSummary:true,idempotency:true,demoPersistence:true,keyClearedOnReload:true,mcpMessageTransport:true,failures,mobile:true,modelRequests:modelRequests.length}));
}catch(e){console.log('BROWSER_ERRORS',errors);console.log('OVERLAY',await page.locator('#__vinext_dev_error_overlay_root').allTextContents());console.log('NOTICE',await page.locator('.notice').allTextContents());await page.screenshot({path:'outputs/browser-failure.png',fullPage:true});throw e;}finally{await browser.close();}
