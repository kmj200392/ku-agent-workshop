import test from 'node:test';
import assert from 'node:assert/strict';
import {modelChat} from '../lib/browser-client.mjs';
import {modelConfig,MODEL_PROVIDERS} from '../lib/model-providers.mjs';

const base={limits:{outputTokens:2048}};
const tools=[{type:'function',function:{name:'lookup',parameters:{type:'object',properties:{id:{type:'string'}},required:['id']}}}];
const messages=[{role:'user',content:'Look up A'}];
test('both providers request Luna with their own key and endpoint',async t=>{
 const seen=[];
 const call={id:'call_1',type:'function',function:{name:'lookup',arguments:'{"id":"A"}'}};
 t.mock.method(globalThis,'fetch',async(url,init)=>{seen.push({url,...init,payload:JSON.parse(init.body)});return Response.json({choices:[{message:{role:'assistant',content:null,tool_calls:[call]}}]});});
 for(const provider of ['school','openai']){
  const config=modelConfig(base,provider),signal=new AbortController().signal;
  const reply=await modelChat('fixture-'+provider,config,messages,tools,signal);
  const req=seen.at(-1);
  assert.equal(req.url,MODEL_PROVIDERS[provider].gateway);
  assert.equal(req.headers.Authorization,'Bearer fixture-'+provider);
  assert.equal(req.signal,signal);
  assert.equal(req.payload.model,'gpt-6-luna');
  assert.deepEqual(reply.tool_calls,[call]);assert.deepEqual(req.payload.tools,tools);
  assert.equal(req.payload.reasoning_effort,'none');assert.equal(req.payload.max_completion_tokens,2048);
  assert.equal(req.payload.store,false);assert(!('max_tokens' in req.payload));
 }
});
test('previously frozen school submissions keep their original model and parameters',async t=>{
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  const payload=JSON.parse(init.body);
  assert.equal(url,MODEL_PROVIDERS.school.gateway);
  assert.equal(payload.model,'claude-haiku-5-5');assert.equal(payload.max_tokens,2048);
  assert(!('reasoning_effort' in payload));assert(!('max_completion_tokens' in payload));
  return Response.json({choices:[{message:{content:'Done'}}]});
 });
 await modelChat('fixture-school',modelConfig(base,'school','claude-haiku-5-5'),messages,tools);
});
test('provider errors never echo keys or retry a different API',async t=>{
 let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({error:{message:'private-fixture-key'}},{status:401});});
 await assert.rejects(modelChat('private-fixture-key',modelConfig(base,'openai'),messages),{message:'OpenAI API HTTP 401: 키를 확인해주세요.'});
 assert.equal(calls,1);
 await assert.rejects(modelChat('',modelConfig(base,'school'),messages),/학교 API 키/);
 assert.equal(calls,1);assert.throws(()=>modelConfig(base,'unknown'),/지원하지 않는/);
});
test('tool results and cancellation pass through without being changed',async t=>{
 const ctl=new AbortController(),history=[...messages,{role:'assistant',content:null,tool_calls:[{id:'c1',type:'function',function:{name:'lookup',arguments:'{}'}}]},{role:'tool',tool_call_id:'c1',content:'{"found":true}'}];
 t.mock.method(globalThis,'fetch',async(_,init)=>{assert.deepEqual(JSON.parse(init.body).messages,history);assert.equal(init.signal,ctl.signal);return Response.json({choices:[{message:{content:'Found'}}]});});
 assert.deepEqual(await modelChat('fixture',modelConfig(base,'openai'),history,tools,ctl.signal),{role:'assistant',content:'Found'});
 const stopped=new DOMException('Stopped','AbortError');ctl.abort();
 t.mock.method(globalThis,'fetch',async()=>{throw stopped;});
 await assert.rejects(modelChat('fixture',modelConfig(base,'openai'),history,tools,ctl.signal),e=>e===stopped);
});
