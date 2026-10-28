import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),base=process.env.BASE_URL||'http://localhost:3000',errors=[],modelRequests=[],uploads=[];
const button=name=>page.getByRole('button',{name,exact:true});
const ids=['cover','instructor','overview','journey','ready','llm-key'];
const visible=async id=>page.locator(`[data-intro-page="${id}"]`).waitFor();
page.on('request',r=>{if(r.url().startsWith(base+'/api/')&&r.method()==='POST')uploads.push(r.postData());});
await page.route(/https:\/\/api\.(baze\.co|openai\.com)\//,route=>route.abort());
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/api\.(baze\.co|openai\.com)/.test(r.url()))modelRequests.push(r.url());});
await mkdir('outputs/course-intro',{recursive:true});
try{
 await page.goto(base+'/agents');await visible('cover');
 assert.deepEqual((await page.locator('.sidebar nav button').allTextContents()).slice(0,2),['강의 소개','1일차 강의']);
 await button('강의 만나보기').click();await visible('instructor');
 await button('1일차 강의').click();await page.getByRole('region',{name:'1일차 웹 강의',exact:true}).waitFor();
 await button('강의 소개').click();await visible('instructor');
 await page.reload();await visible('instructor');
 await page.locator('.course-intro').focus();await page.keyboard.press('ArrowRight');await visible('overview');
 await page.keyboard.press('ArrowLeft');await visible('instructor');
 await page.goBack();await visible('overview');
 await page.getByRole('button',{name:'목차 03 / 06',exact:true}).click();
 await page.getByRole('navigation',{name:'소개 목차',exact:true}).getByRole('button',{name:'05 시작 준비',exact:true}).click();await visible('ready');
 await button('참가 · API 설정').click();await page.getByRole('dialog').waitFor();await button('설정 닫기').click();await visible('ready');
 await button('LLM 키 설정하기').click();await visible('llm-key');
 const inline=page.getByRole('region',{name:'LLM API 키 설정',exact:true});
 const input=page.locator('#intro-api-key');
 await input.fill('fixture-school-intro');await input.press('ArrowLeft');await visible('llm-key');
 await inline.getByRole('button',{name:'OpenAI API',exact:true}).click();assert.equal(await input.inputValue(),'');
 await input.fill('fixture-openai-intro');
 assert.equal(await inline.getByRole('link',{name:'API 키 발급',exact:true}).getAttribute('href'),'https://platform.openai.com/api-keys');
 await button('참가 · API 설정 열기').click();
 const dialog=page.getByRole('dialog');assert.equal(await dialog.locator('#api-key').inputValue(),'fixture-openai-intro');
 await dialog.getByRole('button',{name:'고려대학교 API',exact:true}).click();assert.equal(await dialog.locator('#api-key').inputValue(),'fixture-school-intro');
 await dialog.locator('#api-key').fill('fixture-school-updated');await button('설정 완료').click();assert.equal(await input.inputValue(),'fixture-school-updated');
 await button('이전 주제').click();await visible('ready');await button('다음 주제').click();await visible('llm-key');assert.equal(await input.inputValue(),'fixture-school-updated');
 await button('선택한 키 지우기').click();assert.equal(await input.inputValue(),'');
 await inline.getByRole('button',{name:'OpenAI API',exact:true}).click();assert.equal(await input.inputValue(),'fixture-openai-intro');
 assert(!(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).includes('fixture-'));
 assert(uploads.every(body=>!body?.includes('fixture-')));assert.equal(modelRequests.length,0);
 await page.reload();await visible('llm-key');assert.equal(await input.inputValue(),'');
 await inline.getByRole('button',{name:'고려대학교 API',exact:true}).click();assert.equal(await input.inputValue(),'');
 await button('1일차 강의 시작하기').click();await page.locator('.lesson-start').waitFor();assert.equal(new URL(page.url()).hash,'#lesson/start');
 // New introduction and Day 1 keep independent resume positions and recorded output.
 await page.goto(base+'/agents#lesson/llm-agent');await button('예시 기록').click();await button('기록 불러오기').click();await page.getByText('최종 답변',{exact:true}).waitFor();
 const recorded=await page.evaluate(()=>localStorage.getItem('ku-agent:demo:record:D01'));
 await button('강의 소개').click();await visible('llm-key');await button('1일차 강의').click();await page.getByText('최종 답변',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('ku-agent:demo:record:D01')),recorded);
 const layout=[];
 for(const viewport of [{width:1440,height:1000},{width:1280,height:720},{width:1024,height:768},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  for(const id of ids){
   await page.goto(base+'/agents#intro/'+id);await visible(id);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${id} horizontal overflow at ${viewport.width}`);
   if(viewport.width===1440||viewport.width===390)await page.screenshot({path:`outputs/course-intro/${viewport.width}-${id}.png`,fullPage:true});
   // Exercise fallback layout at the exact requested viewport.
   await page.locator('.course-intro').evaluate(el=>{el.requestFullscreen=async()=>{throw new Error('fixture embedded browser');};});
   await button('전체화면').click();await button('전체 화면 닫기').waitFor();
   const metrics=await page.evaluate(()=>{const root=document.querySelector('.course-intro'),content=document.querySelector('.intro-content')||document.querySelector('.intro-cover-grid');return {rootOverflow:root.scrollHeight-root.clientHeight,contentOverflow:content.scrollHeight-content.clientHeight,footerBottom:root.querySelector('footer').getBoundingClientRect().bottom,height:innerHeight};});
   layout.push({id,...viewport,...metrics});assert(metrics.rootOverflow<=1&&metrics.footerBottom<=metrics.height+1,JSON.stringify(layout.at(-1)));
   if(viewport.width>=1024)assert(metrics.contentOverflow<=1,JSON.stringify(layout.at(-1)));
   await button('전체 화면 닫기').click();
  }
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/agents#intro/cover');await visible('cover');
 // Reload restores the native browser method after the fallback fixture.
 await page.reload();await visible('cover');await button('전체화면').click();assert(await page.evaluate(()=>!!document.fullscreenElement));
 await page.screenshot({path:'outputs/course-intro/fullscreen-cover.png'});await page.keyboard.press('ArrowRight');await visible('instructor');await button('전체 화면 닫기').click();
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
 // Final phase must not start evaluation while someone is typing an inline key.
 const finalPage=await browser.newPage();let finalStarts=0;finalPage.on('pageerror',e=>errors.push(e.message));
 await finalPage.route('**/api/config',async route=>{const response=await route.fetch();await route.fulfill({json:{...await response.json(),phase:'final',signedIn:true}});});
 await finalPage.route('**/api/me',route=>route.fulfill({json:{participant:{nickname:'Fixture'}}}));
 await finalPage.route('**/api/final-start',route=>{finalStarts++;return route.fulfill({status:409,json:{error:'Fixture: must not start while editing'}});});
 await finalPage.goto(base+'/agents#intro/llm-key');await finalPage.getByText('최종 평가',{exact:true}).waitFor();await finalPage.getByText('Fixture',{exact:true}).waitFor();await finalPage.locator('#intro-api-key').pressSequentially('fixture-final-key',{delay:20});
 await finalPage.getByRole('button',{name:'API 및 참가 설정',exact:true}).click();await finalPage.getByRole('button',{name:'설정 완료',exact:true}).click();
 assert.equal(finalStarts,0);await finalPage.close();
 assert.deepEqual(errors,[]);assert.equal(modelRequests.length,0);
 console.log(JSON.stringify({status:'passed',pages:6,viewports:4,keyboard:true,resume:true,day1Preserved:true,apiSetup:true,sharedKeys:true,providerIsolation:true,keysClearedOnReload:true,finalTypingNoEvaluation:true,fullscreen:true,modelCalls:0,pageErrors:errors}));
}finally{await browser.close();}
