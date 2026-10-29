import { db } from '../../../lib/database';
import { getParticipant, authRateLimit, registerParticipant, loginParticipant, logoutParticipant, nicknamePattern } from '../../../lib/participant-auth';
import { CONFIG } from '../../../lib/config';
import {isInstructor,workshopSchedule,FINAL_WINDOW_MS} from '../../../lib/workshop-control';
import { MODEL_PROVIDERS } from '../../../lib/model-providers.mjs';
import { practiceSuite, finalSuite } from '../../../lib/suites';
import { z } from 'zod';
import { FINAL_CANDIDATE_SQL } from '../../../lib/queries';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;
const json=(d:any,status=200,cache=false)=>Response.json(d,{status,headers:{'Cache-Control':cache?'public, max-age=15':'no-store','X-Content-Type-Options':'nosniff'}});
const uid=z.string().uuid();
const detail=z.object({id:z.string().max(64),status:z.enum(['pass','fail','error']),elapsed:z.number().finite().min(0).max(CONFIG.limits.caseMs+60000),modelCalls:z.number().int().min(0).max(CONFIG.limits.caseModelCalls),toolCalls:z.number().int().min(0).max(CONFIG.limits.caseToolCalls)}).strict();
const finishSchema=z.object({runId:z.string().max(80),status:z.enum(['completed','error','aborted']),cases:z.array(detail).max(CONFIG.finalCount),elapsed:z.number().finite().min(0).max(3600000)}).strict();
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
async function body(req:Request,max=110*1024) {
 if(!req.headers.get('content-type')?.includes('application/json')) throw new Error('JSON 요청만 허용합니다.');
 if(Number(req.headers.get('content-length')||0)>max)throw Error('요청 크기 제한을 초과했습니다.');
 const reader=req.body?.getReader();if(!reader)throw Error('빈 요청입니다.');let n=0;const chunks=[];
 while(true){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>max){await reader.cancel();throw Error('요청 크기 제한을 초과했습니다.');}chunks.push(r.value);}
 const bytes=new Uint8Array(n);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
async function handle(req:Request) {
 const action=new URL(req.url).pathname.split('/').at(-1); const user=await getParticipant();const now=Date.now();
 const schedule=await workshopSchedule(now);
 if(req.method==='GET') {
  if(action==='config')return json({...CONFIG,...schedule,serverNow:now,signedIn:!!user,isInstructor:await isInstructor(user)});
  if(action==='suite') {const final=new URL(req.url).searchParams.get('kind')==='final';if(final&&schedule.phase==='practice')return json({error:'최종 평가는 코드 마감 후 공개됩니다.'},403);return json({version:final?CONFIG.finalVersion:CONFIG.practiceVersion,cases:final?finalSuite:practiceSuite});}
  if(action==='leaderboard') {
   const kind=new URL(req.url).searchParams.get('kind')==='final'?'final':'practice';
   const rows=await db().prepare(`WITH ranked AS (SELECT r.id,r.owner,r.score,r.total,r.model_calls,r.tool_calls,r.elapsed,r.finished,r.hash,r.provider,r.model,ROW_NUMBER() OVER(PARTITION BY r.owner ORDER BY r.score DESC,r.finished ASC) AS position FROM runs r WHERE r.kind=? AND r.suite=? AND r.status='completed') SELECT r.id,p.nickname,r.score,r.total,r.model_calls,r.tool_calls,r.elapsed,r.finished,r.hash,r.provider,r.model FROM ranked r JOIN participants p ON p.id=r.owner WHERE r.position=1 ORDER BY r.score DESC,r.finished ASC LIMIT 200`).bind(kind,kind==='final'?CONFIG.finalVersion:CONFIG.practiceVersion).all();
   let rank=0,last=-1;const entries=rows.results.map((r:any,i:number)=>{if(r.score!==last){rank=i+1;last=r.score;}return {...r,rank,hash:r.hash.slice(0,10)};});
   return json({kind,entries,updatedAt:now,trust:'client-reported'},200,true);
  }
  if(action==='me') {
   if(!user)return json({participant:null,runs:[]});
   const p=await db().prepare('SELECT nickname FROM participants WHERE id=?').bind(user.userId).first();
   const r=await db().prepare('SELECT id,kind,status,created,finished,score,total,hash,summary,provider,model FROM runs WHERE owner=? AND suite IN (?,?) ORDER BY created DESC LIMIT 20').bind(user.userId,CONFIG.practiceVersion,CONFIG.finalVersion).all();
   return json({participant:p,runs:r.results});
  }
  return json({error:'없는 경로입니다.'},404);
 }
 if(req.method!=='POST')return json({error:'허용되지 않은 메서드입니다.'},405);
 // Next.js may normalize req.url to localhost behind its server. Validate
 // against the request Host instead; Vercel production always requires HTTPS.
 const protocol=process.env.VERCEL?'https:':new URL(req.url).protocol;
 if(req.headers.get('origin')!==`${protocol}//${req.headers.get('host')}`)return json({error:'요청 출처가 일치하지 않습니다.'},403);
 if(action==='register'||action==='login') {
  if(user)return json({error:'이미 참가 중입니다. 다른 계정으로 접속하려면 먼저 로그아웃해주세요.'},409);
  if(!await authRateLimit(req,action))return json({error:'접속 요청이 많습니다. 1분 후 다시 시도해주세요.'},429);
  if(action==='register') {
   const p=z.object({nickname:z.string().trim().min(2).max(24).regex(nicknamePattern)}).strict().parse(await body(req,1024));
   return json(await registerParticipant(p.nickname));
  }
  const p=z.object({code:z.string().min(1).max(100)}).strict().parse(await body(req,1024));
  return await loginParticipant(p.code)?json({signedIn:true}):json({error:'참가 코드를 확인해주세요.'},401);
 }
 if(action==='logout'){await body(req,512);await logoutParticipant();return json({signedIn:false});}
 if(!user)return json({error:'참가 코드로 먼저 접속해주세요.'},401);
 if(action==='start-final-for-all'){
  if(!await isInstructor(user))return json({error:'강사 계정만 전체 최종 평가를 시작할 수 있습니다.'},403);
  z.object({confirm:z.literal(true)}).strict().parse(await body(req,512));
  if(schedule.manualStart)return json({started:true,alreadyStarted:true,...schedule});
  if(schedule.phase!=='practice')return json({error:'이미 예정된 최종 평가가 시작되었거나 종료되었습니다.'},409);
  // First click wins; retries and concurrent clicks cannot move the cutoff or deadline.
  await db().prepare('INSERT OR IGNORE INTO workshop_control(version,freeze_at,close_at,started_by) VALUES(?,?,?,?)').bind(CONFIG.finalVersion,now,now+FINAL_WINDOW_MS,user.userId).run();
  return json({started:true,...await workshopSchedule()});
 }
 if(action==='join') {
  const p=z.object({nickname:z.string().trim().min(2).max(24).regex(/^[\p{L}\p{N} _.-]+$/u)}).strict().parse(await body(req,1024));
  await db().prepare('UPDATE participants SET nickname=? WHERE id=?').bind(p.nickname,user.userId).run();
  return json({nickname:p.nickname});
 }
 const participant=await db().prepare('SELECT id FROM participants WHERE id=?').bind(user.userId).first();if(!participant)return json({error:'참가 이름을 먼저 등록해주세요.'},409);
 if(action==='submit') {
  const p=z.object({requestId:uid,code:z.string().min(1).max(CONFIG.limits.codeBytes),provider:z.enum(['school','openai']).default('school')}).strict().parse(await body(req));
  if(new TextEncoder().encode(p.code).length>CONFIG.limits.codeBytes) return json({error:'코드는 100 KiB 이하로 제출해주세요.'},400);
  const id=await hash(`${user.userId}:${p.requestId}`), codeHash=await hash(p.code), model=MODEL_PROVIDERS[p.provider].model;
  const previous=await db().prepare('SELECT id,hash,status,suite,provider,model FROM runs WHERE id=? AND owner=?').bind(id,user.userId).first<any>();
  if(previous) return previous.hash===codeHash&&previous.suite===CONFIG.practiceVersion&&previous.provider===p.provider&&previous.model===model?json({runId:id,hash:codeHash,suite:previous.suite,status:previous.status,provider:previous.provider,model:previous.model}):json({error:'이미 사용한 제출 ID입니다.'},409);
  if(schedule.phase!=='practice')return json({error:'코드 제출이 마감되었습니다. 마감 전 평가가 완료된 마지막 코드를 사용합니다.'},409);
  const count=await db().prepare('SELECT COUNT(*) AS n FROM runs WHERE owner=?').bind(user.userId).first<any>();
  if(count.n>=60)return json({error:'수업 전체 제출 한도(60회)에 도달했습니다.'},429);
  const recent=await db().prepare('SELECT created FROM runs WHERE owner=? ORDER BY created DESC LIMIT 1').bind(user.userId).first<any>();
  if(recent&&now-recent.created<5000)return json({error:'5초 후 다시 제출해주세요.'},429);
  const inserted=await db().prepare('INSERT INTO runs(id,owner,request_id,code,hash,kind,suite,status,created,provider,model) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM workshop_control WHERE version=?)').bind(id,user.userId,p.requestId,p.code,codeHash,'practice',CONFIG.practiceVersion,'running',now,p.provider,model,CONFIG.finalVersion).run();
  if(!inserted.rowsAffected)return json({error:'강사가 최종 평가를 시작해 코드 제출이 마감되었습니다.'},409);
  return json({runId:id,hash:codeHash,suite:CONFIG.practiceVersion,status:'running',provider:p.provider,model});
 }
 if(action==='final-start') {
  await body(req,512);if(schedule.phase!=='final')return json({error:'최종 평가 시간이 아닙니다.'},409);
  const id='final-'+(await hash(user.userId+':'+CONFIG.finalVersion)).slice(0,40);
  const existing=await db().prepare('SELECT id,code,hash,status,provider,model FROM runs WHERE id=? AND owner=?').bind(id,user.userId).first<any>();
  if(existing) {
   if(existing.status==='completed')return json({runId:id,status:'completed'});
   await db().prepare("UPDATE runs SET status='running',finished=NULL WHERE id=? AND owner=? AND status!='completed'").bind(id,user.userId).run();
   const latest=await db().prepare('SELECT status FROM runs WHERE id=?').bind(id).first<any>();
   if(latest?.status==='completed')return json({runId:id,status:'completed'});
   return json({runId:id,code:existing.code,hash:existing.hash,suite:CONFIG.finalVersion,status:'running',provider:existing.provider,model:existing.model});
  }
  const source=await db().prepare(FINAL_CANDIDATE_SQL).bind(user.userId,Date.parse(schedule.freezeAt),CONFIG.practiceVersion).first<any>();
  if(!source)return json({error:'마감 전에 평가까지 완료된 제출이 없습니다.'},409);
  await db().prepare('INSERT OR IGNORE INTO runs(id,owner,request_id,code,hash,kind,suite,status,created,source_id,provider,model) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,user.userId,id,source.code,source.hash,'final',CONFIG.finalVersion,'running',now,source.id,source.provider,source.model).run();
  return json({runId:id,code:source.code,hash:source.hash,suite:CONFIG.finalVersion,status:'running',provider:source.provider,model:source.model});
 }
 if(action==='finish') {
  const p=finishSchema.parse(await body(req,CONFIG.limits.resultBytes));
  const run=await db().prepare('SELECT * FROM runs WHERE id=? AND owner=?').bind(p.runId,user.userId).first<any>();if(!run)return json({error:'제출을 찾을 수 없습니다.'},404);
  if(![CONFIG.practiceVersion,CONFIG.finalVersion].includes(run.suite))return json({error:'이전 평가 버전의 제출입니다.'},409);
  if(run.status==='completed')return json({saved:true,alreadySaved:true,score:run.score});
  if((run.kind==='final'&&schedule.phase!=='final')||(run.kind==='practice'&&schedule.phase!=='practice')) {
   await db().prepare("UPDATE runs SET status='expired',finished=? WHERE id=? AND owner=? AND status!='completed'").bind(now,p.runId,user.userId).run();
   return json({saved:true,late:true,score:null});
  }
  const ids=(run.kind==='final'?finalSuite:practiceSuite).map(t=>t.id);
  if(new Set(p.cases.map(c=>c.id)).size!==p.cases.length || p.cases.some(c=>!ids.includes(c.id)))return json({error:'평가 항목이 일치하지 않습니다.'},400);
  if(p.status==='completed'&&(p.cases.length!==ids.length||p.cases.some(c=>c.status==='error')))return json({error:'완료된 평가에는 모든 항목의 정상 결과가 필요합니다.'},400);
  const score=p.cases.filter(c=>c.status==='pass').length;
  // Format/counter consistency only. This endpoint never executes code or regrades answers.
  const saved=await db().prepare("UPDATE runs SET status=?,finished=?,score=?,total=?,model_calls=?,tool_calls=?,elapsed=?,summary=? WHERE id=? AND owner=? AND status!='completed' AND (kind!='practice' OR NOT EXISTS (SELECT 1 FROM workshop_control WHERE version=?))").bind(p.status,now,p.status==='completed'?score:null,ids.length,p.cases.reduce((n,c)=>n+c.modelCalls,0),p.cases.reduce((n,c)=>n+c.toolCalls,0),p.elapsed,JSON.stringify(p.cases),p.runId,user.userId,CONFIG.finalVersion).run();
  if(!saved.rowsAffected){
   const latest=await db().prepare('SELECT status,score FROM runs WHERE id=? AND owner=?').bind(p.runId,user.userId).first<any>();
   if(latest?.status==='completed')return json({saved:true,alreadySaved:true,score:latest.score});
   await db().prepare("UPDATE runs SET status='expired',finished=? WHERE id=? AND owner=? AND status!='completed'").bind(now,p.runId,user.userId).run();
   return json({saved:true,late:true,score:null});
  }
  return json({saved:true,score:p.status==='completed'?score:null});
 }
 return json({error:'없는 경로입니다.'},404);
}
export async function GET(req:Request){try{return await handle(req);}catch(e){console.error('GET request failed',e instanceof Error?e.name:'error');return json({error:'저장소를 읽지 못했습니다. 잠시 후 다시 시도해주세요.'},503);}}
export async function POST(req:Request){try{return await handle(req);}catch(e){if(e instanceof z.ZodError)return json({error:'입력 형식이 올바르지 않습니다.'},400);if(e instanceof SyntaxError)return json({error:'JSON 형식이 올바르지 않습니다.'},400);console.error('POST request failed',e instanceof Error?e.name:'error');return json({error:'요청을 처리하지 못했습니다. 입력 크기와 연결 상태를 확인해주세요.'},400);}}
