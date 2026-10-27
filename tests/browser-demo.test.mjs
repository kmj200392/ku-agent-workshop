import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runDemo,searchPolicyChunks} from '../lib/browser-demo.mjs';

function fixtureFetch(url) {
 return new Response(fs.readFileSync(new URL('../public'+url,import.meta.url)),{headers:{'content-type':'application/json'}});
}
test('lecture traces keep the input at each model call, not the final mutable history',async t=>{
 let calls=0;
 t.mock.method(globalThis,'fetch',async url=>{
  if(url.startsWith('/demos/'))return fixtureFetch(url);
  calls++;
  const message=calls===1?{role:'assistant',content:null,tool_calls:[{id:'call-1',type:'function',function:{name:'search_events',arguments:'{"query":"Python"}'}}]}:{role:'assistant',content:'Done'};
  return Response.json({choices:[{message}]});
 });
 const result=await runDemo('D06',{key:'test-only',config:{model:'fixture',gateway:'https://fixture.invalid',limits:{outputTokens:100}}});
 const inputs=result.events.filter(e=>e.kind==='model_input');
 assert.equal(inputs.length,2);
 assert.equal(inputs[0].data.length,2,'first input must not contain later tool results');
 assert.equal(inputs[1].data.length,4);
 assert.equal(inputs[1].data[3].role,'tool');
 assert.equal(inputs[1].data[3].tool_call_id,'call-1');
 assert.equal(result.events.filter(e=>e.kind==='tool').length,1);
 const listing=result.events.find(e=>e.kind==='tool').data.value;
 assert.equal(listing.count,4);
 assert.deepEqual(Object.keys(listing.events[0]),['id','title'],'details must require get_event');
});
test('RAG returns cited sections rather than entire files, and no evidence for an absent topic',()=>{
 const policies=JSON.parse(fs.readFileSync(new URL('../public/demos/policies.json',import.meta.url)));
 const chunks=searchPolicyChunks(policies,'E-102 신청 자격');
 assert.equal(chunks[0].source,'admission.md#1');
 assert.ok(!chunks[0].text.includes('## 2'));
 assert.deepEqual(searchPolicyChunks(policies,'주차 할인'),[]);
});
test('browser retrieval and MCP discovery run without model calls or keys',async t=>{
 t.mock.method(globalThis,'fetch',async url=>{
  assert.ok(url.startsWith('/demos/'),'no external model request');
  return fixtureFetch(url);
 });
 const search=await runDemo('D10',{});
 assert.ok(search.events.some(e=>e.kind==='retrieval'&&e.data.length>0));
 const mcp=await runDemo('D08',{});
 assert.deepEqual(mcp.events.filter(e=>e.kind==='mcp_request').map(e=>e.data.method),['initialize','tools/list']);
 assert.equal(mcp.events.find(e=>e.kind==='tools').data.tools.length,2);
});
