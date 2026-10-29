import assert from 'node:assert/strict';
import test from 'node:test';
import {practiceFeedback} from '../lib/practice-feedback.mjs';
const fixture={id:'practice',ground_truth:[['lookup(value=1)'],[],['cancel(id="a")']],entry:{question:[[{content:'Find it'}],[{content:'Wait'}],[{content:'Now cancel'}]]}};
test('feedback locates the first failure and treats later checks as cumulative',()=>{
 const record={id:'practice',status:'fail',checks:[{pass:true},{pass:false,error:'multi_turn:irrelevance_error:decoder_success'},{pass:false,error:'multi_turn:instance_state_mismatch'}],trace:[{kind:'tool',name:'lookup',args:{value:1},value:{id:'a'}},{kind:'next-turn'},{kind:'tool',name:'cancel',args:{id:'a'},value:{cancel_status:true}},{kind:'next-turn'}]};
 const f=practiceFeedback(fixture,record);assert.equal(f.firstFailure,2);assert.equal(f.turns[1].actual[0].name,'cancel');assert.equal(f.turns[1].reason,'기다려야 하는 턴에 도구를 실행했어요');assert.equal(f.turns[2].state,'affected');assert.deepEqual(f.turns[1].expected,[]);
});
test('execution failure and truncated trace never pretend an unseen tool did not run',()=>{
 const f=practiceFeedback(fixture,{id:'practice',status:'error',trace:Array.from({length:150},()=>({kind:'print',text:'x'}))});
 assert.equal(f.firstFailure,null);assert.equal(f.truncated,true);assert.equal(f.turns[0].complete,false);assert.equal(f.turns[1].complete,false);assert.equal(f.turns[1].state,'ungraded');
});
test('feedback requires a matching public practice fixture and exposes tool errors',()=>{
 assert.equal(practiceFeedback(undefined,{id:'final'}),null);assert.equal(practiceFeedback(fixture,{id:'final'}),null);
 const f=practiceFeedback(fixture,{id:'practice',status:'fail',trace:[{kind:'tool',name:'cancel',value:{error:'Unknown booking'}}]});assert.equal(f.turns[0].toolErrors.length,1);
});
