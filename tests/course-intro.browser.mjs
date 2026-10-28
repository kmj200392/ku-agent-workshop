import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),base=process.env.BASE_URL||'http://localhost:3000',errors=[],modelRequests=[];
const button=name=>page.getByRole('button',{name,exact:true});
const ids=['cover','instructor','overview','journey','ready'];
const visible=async id=>page.locator(`[data-intro-page="${id}"]`).waitFor();
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
 await page.getByRole('button',{name:'목차 03 / 05',exact:true}).click();
 await page.getByRole('navigation',{name:'소개 목차',exact:true}).getByRole('button',{name:'05 시작 준비',exact:true}).click();await visible('ready');
 await button('참가 · API 설정').click();await page.getByRole('dialog').waitFor();await button('설정 닫기').click();await visible('ready');
 await button('1일차 강의 시작하기').click();await page.locator('.lesson-start').waitFor();assert.equal(new URL(page.url()).hash,'#lesson/start');
 // New introduction and Day 1 keep independent resume positions and recorded output.
 await page.goto(base+'/agents#lesson/llm-agent');await button('예시 기록').click();await button('기록 불러오기').click();await page.getByText('최종 답변',{exact:true}).waitFor();
 const recorded=await page.evaluate(()=>localStorage.getItem('ku-agent:demo:record:D01'));
 await button('강의 소개').click();await visible('ready');await button('1일차 강의').click();await page.getByText('최종 답변',{exact:true}).waitFor();
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
 assert.deepEqual(errors,[]);assert.equal(modelRequests.length,0);
 console.log(JSON.stringify({status:'passed',pages:5,viewports:4,keyboard:true,resume:true,day1Preserved:true,apiSetup:true,fullscreen:true,modelCalls:0,pageErrors:errors}));
}finally{await browser.close();}
