import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {summaryForUpload} from '../lib/browser-client.mjs';
const suites=JSON.parse(fs.readFileSync(new URL('../lib/bfcl-suites.json',import.meta.url)));
test('suite IDs, counts and original families are distinct',()=>{
 assert.equal(suites.practice.length,6);assert.equal(suites.final.length,20);
 assert.equal(new Set([...suites.practice,...suites.final].map(x=>x.id)).size,26);
 const practice=new Set(suites.practice.map(x=>x.family));assert.ok(suites.final.every(x=>!practice.has(x.family)));
});
test('result uploads contain counters only, no API keys, task data, answers or traces',()=>{
 const result={status:'completed',elapsed:1,cases:[{id:'multi_turn_base_150',status:'pass',elapsed:1,modelCalls:1,toolCalls:1,answer:'private',trace:[{key:'private'}]}]};
 assert.deepEqual(Object.keys(summaryForUpload('run',result).cases[0]),['id','status','elapsed','modelCalls','toolCalls']);
});
test('all selected fixtures are original TravelAPI-only with corresponding answer turns',()=>{
 for(const x of [...suites.practice,...suites.final]){assert.deepEqual(x.entry.involved_classes,['TravelAPI']);assert.equal(x.entry.question.length,x.ground_truth.length);assert.equal(x.id,x.entry.id);}
});
