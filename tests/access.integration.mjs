import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
const temp = await mkdtemp(join(tmpdir(),'ku-agent-access-'));
const database = `file:${join(temp,'test.db')}`;
const env = {...process.env,TURSO_DATABASE_URL:database,NODE_ENV:'production'};
const migrated = spawnSync(process.execPath,['scripts/migrate.mjs'],{env,encoding:'utf8'});
assert.equal(migrated.status,0,migrated.stderr);
const base='http://127.0.0.1:3107';
let server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3107','-H','127.0.0.1'],{env,stdio:['ignore','pipe','pipe']});
let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const sql=createClient({url:database});
async function request(action,data,cookie='',extra={}) {
  const response=await fetch(`${base}/api/${action}`,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',origin:base,...(cookie?{cookie}:{}),...extra},...(data===undefined?{}:{body:JSON.stringify(data)})});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],setCookie:response.headers.get('set-cookie')};
}
try {
  let ready=false;
  for(let n=0;n<100;n++){try{if((await fetch(base)).ok){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,logs);
  assert.equal((await request('config')).data.signedIn,false);
  assert.equal((await request('submit',{requestId:crypto.randomUUID(),code:'x'},'',{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@example.com'})).status,401);
  assert.equal((await request('register',{nickname:'교차출처'},'',{origin:'https://evil.example'})).status,403);
  const a=await request('register',{nickname:'검증 참가자 A'});
  assert.equal(a.status,200);assert.match(a.data.accessCode,/^[a-f0-9]{6}(-[a-f0-9]{6}){5}$/);
  assert.match(a.setCookie,/HttpOnly/i);assert.match(a.setCookie,/Secure/i);assert.match(a.setCookie,/SameSite=lax/i);
  assert.equal((await request('config',undefined,a.cookie)).data.signedIn,true);
  const requestId=crypto.randomUUID();
  const run=await request('submit',{requestId,code:'async def agent(task, api): return "ok"',provider:'openai'},a.cookie);
  assert.equal(run.status,200);assert.equal(run.data.provider,'openai');assert.equal(run.data.model,'gpt-6-luna');
  assert.equal((await request('submit',{requestId,code:'async def agent(task, api): return \"ok\"',provider:'school'},a.cookie)).status,409);
  assert.equal((await request('submit',{requestId:crypto.randomUUID(),code:'x',provider:'unknown'},a.cookie)).status,400);
  assert.equal((await request('submit',{requestId,code:'async def agent(task, api): return "ok"',provider:'openai'},a.cookie)).data.runId,run.data.runId);
  const suite=(await request('suite')).data;
  const payload={runId:run.data.runId,status:'completed',elapsed:60,cases:suite.cases.map(c=>({id:c.id,status:'pass',elapsed:10,modelCalls:0,toolCalls:1}))};
  const b=await request('register',{nickname:'검증 참가자 B'});
  assert.equal((await request('finish',payload,b.cookie)).status,404);
  assert.equal((await request('finish',payload,a.cookie)).data.score,6);
  assert.equal((await request('finish',payload,a.cookie)).data.alreadySaved,true);
  const row=(await request('leaderboard')).data.entries[0];
  assert.equal(row.nickname,'검증 참가자 A');assert.equal(row.provider,'openai');assert.equal(row.model,'gpt-6-luna');
  assert.equal((await request('suite?kind=final')).status,403);
  const recovered=await request('login',{code:a.data.accessCode});
  assert.equal(recovered.status,200);
  assert.equal((await request('me',undefined,recovered.cookie)).data.runs[0].id,run.data.runId);
  assert.equal((await request('login',{code:'000000-000000-000000-000000-000000-000000'})).status,401);
  await request('logout',{},a.cookie);
  assert.equal((await request('config',undefined,a.cookie)).data.signedIn,false);
  assert.equal((await request('config',undefined,recovered.cookie)).data.signedIn,true);
  const rows=await sql.execute('SELECT access_hash FROM participants');
  assert.ok(rows.rows.every(r=>/^[a-f0-9]{64}$/.test(r.access_hash)));
  // A separate server clock exercises final freeze without modifying source/config.
  server.kill('SIGTERM');await new Promise(r=>server.on('exit',r));
  const clock=join(temp,'final-clock.cjs');
  await writeFile(clock,"Date.now=()=>Date.parse('2026-10-29T20:36:00+09:00');\n");
  server=spawn(process.execPath,['--require',clock,'node_modules/next/dist/bin/next','start','-p','3107','-H','127.0.0.1'],{env,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
  let finalReady=false;
  for(let n=0;n<100;n++){try{if((await request('config')).data.phase==='final'){finalReady=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert(finalReady,logs);
  const frozen=await request('final-start',{},recovered.cookie);
  assert.equal(frozen.status,200);assert.equal(frozen.data.provider,'openai');assert.equal(frozen.data.model,'gpt-6-luna');assert.equal(frozen.data.hash,run.data.hash);
  const retried=await request('final-start',{provider:'school'},recovered.cookie);
  assert.equal(retried.data.provider,'openai');assert.equal(retried.data.model,'gpt-6-luna');assert.equal(retried.data.runId,frozen.data.runId);
  const finalSuite=(await request('suite?kind=final')).data;
  const finalPayload={runId:frozen.data.runId,status:'completed',elapsed:200,cases:finalSuite.cases.map(c=>({id:c.id,status:'pass',elapsed:10,modelCalls:1,toolCalls:1}))};
  assert.equal((await request('finish',finalPayload,recovered.cookie)).data.score,20);
  assert.equal((await request('final-start',{},recovered.cookie)).data.status,'completed');
  assert.equal((await request('leaderboard?kind=final')).data.entries[0].model,'gpt-6-luna');
  console.log('PASS: access control, provider validation, submission idempotency, model on leaderboard, frozen provider/model and final retry/completion.');
} catch(e) { console.error(logs); throw e; } finally {
  sql.close();server.kill('SIGTERM');await new Promise(r=>server.on('exit',r));await rm(temp,{recursive:true,force:true});
}
