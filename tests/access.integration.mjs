import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
const temp = await mkdtemp(join(tmpdir(),'ku-agent-access-'));
const database = `file:${join(temp,'test.db')}`;
const env = {...process.env,TURSO_DATABASE_URL:database,NODE_ENV:'production'};
const migrated = spawnSync(process.execPath,['scripts/migrate.mjs'],{env,encoding:'utf8'});
assert.equal(migrated.status,0,migrated.stderr);
const base='http://127.0.0.1:3107';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3107','-H','127.0.0.1'],{env,stdio:['ignore','pipe','pipe']});
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
  const run=await request('submit',{requestId,code:'async def agent(task, api): return "ok"'},a.cookie);
  assert.equal(run.status,200);
  assert.equal((await request('submit',{requestId,code:'async def agent(task, api): return "ok"'},a.cookie)).data.runId,run.data.runId);
  const suite=(await request('suite')).data;
  const payload={runId:run.data.runId,status:'completed',elapsed:60,cases:suite.cases.map(c=>({id:c.id,status:'pass',elapsed:10,modelCalls:0,toolCalls:1}))};
  const b=await request('register',{nickname:'검증 참가자 B'});
  assert.equal((await request('finish',payload,b.cookie)).status,404);
  assert.equal((await request('finish',payload,a.cookie)).data.score,6);
  assert.equal((await request('finish',payload,a.cookie)).data.alreadySaved,true);
  assert.equal((await request('leaderboard')).data.entries[0].nickname,'검증 참가자 A');
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
  console.log('PASS: public browsing, signed session, cross-origin rejection, spoofed Sites headers rejected, registration/login/logout, recovery, ownership, submit/finish persistence and final gating.');
} catch(e) { console.error(logs); throw e; } finally {
  sql.close();server.kill('SIGTERM');await new Promise(r=>server.on('exit',r));await rm(temp,{recursive:true,force:true});
}
