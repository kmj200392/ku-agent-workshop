import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const base=process.env.BASE_URL||'http://localhost:3000';
const ids=['start','llm-agent','agent-flow','model-api','prompt','tool-calling','agent-loop','stop','mcp-discovery','mcp-call','retrieval','rag','conversation','memory','together','your-agent','day2','reference'];
const sizes=[[1440,900],[1280,720],[1024,768],[589,848],[390,844]];
const errors=[],modelRequests=[];
await fs.mkdir('outputs/web-lecture',{recursive:true});
try{
 const page=await browser.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url().includes('api.baze.co'))modelRequests.push(r.url());});
 const button=name=>page.getByRole('button',{name,exact:true});
 async function checkFrame(label){
  const metrics=await page.evaluate(()=>{
   const targets=[...document.querySelectorAll('.web-lecture,.lesson-page,.lesson-body,.lesson-concept,.lesson-welcome,.lesson-execution')];
   return {
    overflow:targets.filter(el=>el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2).map(el=>({className:el.className,height:el.clientHeight,content:el.scrollHeight})),
    footer:document.querySelector('.lesson-footer').getBoundingClientRect().bottom,
    viewport:innerHeight,
    bodyLocked:document.body.style.overflow==='hidden',
   };
  });
  assert.deepEqual(metrics.overflow,[],label+' must fit without clipping or page scrolling');
  assert(metrics.footer<=metrics.viewport+1,label+' footer must remain visible');
  assert(metrics.bodyLocked,label+' underlying page must not scroll');
 }
 await page.goto(base+'/agents#lesson/start');
 await button('전체화면').click();await button('전체 화면 닫기').waitFor();
 assert(await page.evaluate(()=>!!document.fullscreenElement),'native fullscreen should activate');
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});
  for(const id of ids){
   await page.evaluate(id=>location.hash='lesson/'+id,id);
   await page.locator('article.lesson-'+id).waitFor();
   await checkFrame(`${width}x${height} ${id}`);
  }
 }
 // Completed recorded runs and expanded logs must stay in the same frame.
 for(const [width,height] of [[1280,720],[589,848],[390,844]]){
  await page.setViewportSize({width,height});
  for(const id of ids.slice(1,15)){
   await page.evaluate(id=>location.hash='lesson/'+id,id);await page.locator('article.lesson-'+id).waitFor();
   await button('예시 기록').click();await button('기록 불러오기').click();
   await button('기록 불러오기').waitFor();
   await page.locator('.execution-heading').getByText('실행 기록 있음',{exact:true}).waitFor();
   await button('결과').click();
   await checkFrame(`${width}x${height} ${id} completed`);
   const result=page.locator('.execution-result-body');
   const resultHeight=await result.evaluate(el=>el.clientHeight);
   assert(resultHeight>=60,`${width}x${height} ${id} result height ${resultHeight}`);
   await page.getByRole('button',{name:/^단계별 기록/}).click();
   await page.locator('.lesson-trace-step>button').first().click();
   await checkFrame(`${width}x${height} ${id} expanded trace`);
   assert(await page.locator('.lesson-trace').evaluate(el=>el.clientHeight>=60),'trace panel must retain usable height');
  }
  await page.screenshot({path:`outputs/web-lecture/fullscreen-${width}.png`});
 }
 await button('전체 화면 닫기').click();
 assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
 // Embedded browsers can reject native fullscreen; the fallback must also fit.
 await page.evaluate(()=>{Element.prototype.requestFullscreen=async()=>{throw new Error('Fullscreen unavailable in fixture');};});
 await page.setViewportSize({width:1280,height:720});
 await button('전체화면').click();await checkFrame('fallback');
 assert.equal(await page.evaluate(()=>!!document.fullscreenElement),false);
 await page.locator('.lesson-outline-toggle').click();
 assert.equal(await page.locator('.lesson-outline button').count(),18);
 await checkFrame('fallback with outline');
 await page.locator('.lesson-outline-toggle').click();
 await page.locator('.web-lecture').focus();await page.keyboard.press('Escape');
 assert.equal(await page.locator('.web-lecture.is-presenting').count(),0);
 assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
 assert.deepEqual(errors,[]);assert.deepEqual(modelRequests,[]);
 console.log(JSON.stringify({status:'passed',topics:18,viewports:sizes.length,recordedRuns:42,nativeAndFallback:true,pageErrors:errors,paidModelRequests:modelRequests.length}));
}finally{await browser.close();}
