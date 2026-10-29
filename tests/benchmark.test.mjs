import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {summaryForUpload} from '../lib/browser-client.mjs';
const suites=JSON.parse(fs.readFileSync(new URL('../lib/bfcl-suites.json',import.meta.url)));
test('suite IDs, counts and original families are distinct',()=>{
 assert.equal(suites.practice.length,12);assert.equal(suites.final.length,30);
 assert.equal(new Set([...suites.practice,...suites.final].map(x=>x.id)).size,42);
 const practice=new Set(suites.practice.map(x=>x.family));assert.ok(suites.final.every(x=>!practice.has(x.family)));
});
test('result uploads contain counters only, no API keys, task data, answers or traces',()=>{
 const result={status:'completed',elapsed:1,cases:[{id:'multi_turn_base_150',status:'pass',elapsed:1,modelCalls:1,toolCalls:1,answer:'private',trace:[{key:'private'}]}]};
 assert.deepEqual(Object.keys(summaryForUpload('run',result).cases[0]),['id','status','elapsed','modelCalls','toolCalls']);
});
test('all selected fixtures are TravelAPI-only with corresponding answer turns',()=>{
 for(const x of [...suites.practice,...suites.final]){assert.deepEqual(x.entry.involved_classes,['TravelAPI']);assert.equal(x.entry.question.length,x.ground_truth.length);assert.equal(x.id,x.entry.id);}
});

test('v2 preserves provenance, adds distinct scenarios and covers all skills in both splits',()=>{
 const categories=['base','miss_param','miss_func','long_context','memory','conditional'];
 for(const [split,cases] of Object.entries(suites)){
  for(const category of categories)assert(cases.some(c=>c.category===category),split+': '+category);
  assert.equal(cases.filter(c=>c.provenance.kind==='authored').length,split==='practice'?6:10);
  assert.equal(new Set(cases.map(c=>c.family)).size,split==='practice'?8:17);
  for(const c of cases){assert(c.provenance);assert(c.ground_truth.some(turn=>turn.length));}
 }
 const manifest=JSON.parse(fs.readFileSync(new URL('../docs/benchmark-v2-manifest.json',import.meta.url)));
 assert.equal(manifest.splits.practice.count,suites.practice.length);assert.equal(manifest.splits.final.count,suites.final.length);
});
