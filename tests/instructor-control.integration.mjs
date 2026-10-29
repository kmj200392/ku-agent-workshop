import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createClient} from '@libsql/client';
const temp=await mkdtemp(join(tmpdir(),'ku-instructor-')),url='file:'+join(temp,'test.db'),env={...process.env,TURSO_DATABASE_URL:url,NODE_ENV:'production'},base='http://127.0.0.1:3112';
const clock=join(temp,'clock.cjs'),clockValue=join(temp,'now');let now=Date.parse('2026-10-29T19:15:00+09:00');
await writeFile(clockValue,String(now));await writeFile(clock,`Date.now=()=>Number(require('node:fs').readFileSync(${JSON.stringify(clockValue)},'utf8'));`);
assert.equal(spawnSync(process.execPath,['scripts/migrate.mjs'],{env,encoding:'utf8'}).status,0);
const sql=createClient({url}),server=spawn(process.execPath,['--require',clock,'node_modules/next/dist/bin/next','start','-p','3112','-H','127.0.0.1'],{env,stdio:['ignore','pipe','pipe']});let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const advance=async ms=>{now+=ms;await writeFile(clockValue,String(now));};
async function req(action,data,cookie=''){const r=await fetch(base+'/api/'+action,{method:data===undefined?'GET':'POST',headers:{origin:base,'content-type':'application/json',cookie},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
try{
 for(let n=0;n<100;n++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const admin=await req('register',{nickname:'민재'}),impostor=await req('register',{nickname:'민재'}),student=await req('register',{nickname:'학생'});
 assert.equal((await req('start-final-for-all',{confirm:true})).status,401);
 assert.equal((await req('start-final-for-all',{confirm:true},impostor.cookie)).status,403);
 const run=await req('submit',{requestId:crypto.randomUUID(),code:'async def agent(task, api): return "frozen"',provider:'openai'},admin.cookie);assert.equal(run.status,200);
 const anchor=(await readFile('lib/workshop-control.ts','utf8')).match(/INSTRUCTOR_RUN_ID='([^']+)'/)[1];
 await sql.execute({sql:'UPDATE runs SET id=? WHERE id=?',args:[anchor,run.data.runId]});
 assert.equal((await req('config',undefined,admin.cookie)).data.isInstructor,true);
 assert.equal((await req('config',undefined,impostor.cookie)).data.isInstructor,false);
 await req('join',{nickname:'이름 변경'},admin.cookie);assert.equal((await req('start-final-for-all',{confirm:true},admin.cookie)).status,403);await req('join',{nickname:'민재'},admin.cookie);
 const suite=(await req('suite')).data,complete=id=>({runId:id,status:'completed',elapsed:50,cases:suite.cases.map(c=>({id:c.id,status:'pass',elapsed:1,modelCalls:0,toolCalls:1}))});
 assert.equal((await req('finish',complete(anchor),admin.cookie)).data.score,12);
 await advance(6000);const pending=await req('submit',{requestId:crypto.randomUUID(),code:'unfinished'},admin.cookie);assert.equal(pending.status,200);
 assert.equal((await req('start-final-for-all',{},admin.cookie)).status,400);
 await advance(1000);
 const starts=await Promise.all([req('start-final-for-all',{confirm:true},admin.cookie),req('start-final-for-all',{confirm:true},admin.cookie)]);
 assert(starts.every(s=>s.status===200));const frozen=starts[0].data;assert.equal(frozen.freezeAt,starts[1].data.freezeAt);assert.equal(Date.parse(frozen.closeAt)-Date.parse(frozen.freezeAt),1200000);
 const publicConfig=(await req('config')).data;assert.equal(publicConfig.phase,'final');assert.equal(publicConfig.manualStart,true);assert.equal(publicConfig.isInstructor,false);
 assert.equal((await req('submit',{requestId:crypto.randomUUID(),code:'late'},student.cookie)).status,409);
 assert.equal((await req('finish',complete(pending.data.runId),admin.cookie)).data.late,true);
 assert.equal((await req('final-start',{},student.cookie)).status,409);
 const final=await req('final-start',{},admin.cookie);assert.equal(final.status,200);assert.match(final.data.code,/frozen/);assert.equal(final.data.provider,'openai');
 const finalSuite=(await req('suite?kind=final')).data;assert.equal(finalSuite.cases.length,30);
 const finished=await req('finish',{runId:final.data.runId,status:'completed',elapsed:50,cases:finalSuite.cases.map(c=>({id:c.id,status:'pass',elapsed:1,modelCalls:0,toolCalls:1}))},admin.cookie);assert.equal(finished.data.score,30);
 assert.equal((await req('final-start',{},admin.cookie)).data.status,'completed');
 await advance(1200000);assert.equal((await req('config')).data.phase,'closed');const retry=await req('start-final-for-all',{confirm:true},admin.cookie);assert.equal(retry.data.freezeAt,frozen.freezeAt);assert.equal(retry.data.closeAt,frozen.closeAt);assert.equal(retry.data.phase,'closed');
 assert.equal((await sql.execute('SELECT COUNT(*) AS n FROM workshop_control')).rows[0].n,1);
 console.log('PASS: instructor owner binding, same-name denial, confirmation, atomic/idempotent global start, 20-minute window, late practice rejection, frozen code/provider, final completion and no reset.');
}catch(e){console.error(logs);throw e;}finally{sql.close();server.kill('SIGTERM');await new Promise(r=>server.on('exit',r));await rm(temp,{recursive:true,force:true});}
