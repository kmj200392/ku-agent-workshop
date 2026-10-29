import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {CONFIG,phase} from '../lib/config.ts';
import {FINAL_CANDIDATE_SQL} from '../lib/queries.ts';

test('phase follows Korean freeze and final close boundaries exactly',()=>{
 const freeze=Date.parse(CONFIG.freezeAt),close=Date.parse(CONFIG.closeAt);
 assert.equal(new Date(freeze).toISOString(),'2026-10-29T11:35:00.000Z');
 assert.equal(phase(freeze-1),'practice');assert.equal(phase(freeze),'final');assert.equal(phase(close-1),'final');assert.equal(phase(close),'closed');
});
test('freeze selects latest completed version, excludes incomplete and late results',()=>{
 const d=new DatabaseSync(':memory:');d.exec('CREATE TABLE runs(id TEXT,owner TEXT,code TEXT,hash TEXT,kind TEXT,status TEXT,created INTEGER,finished INTEGER,suite TEXT,provider TEXT DEFAULT \'school\',model TEXT DEFAULT \'claude-haiku-5-5\')');
 const insert=d.prepare('INSERT INTO runs(id,owner,code,hash,kind,status,created,finished,suite) VALUES(?,?,?,?,?,?,?,?,?)');
 insert.run('old-high-score','a','old','hash1','practice','completed',10,20,CONFIG.practiceVersion);
 insert.run('latest-valid','a','latest','hash2','practice','completed',30,40,CONFIG.practiceVersion);
 insert.run('pending','a','pending','hash3','practice','running',50,null,CONFIG.practiceVersion);
 insert.run('late','a','late','hash4','practice','completed',60,100,CONFIG.practiceVersion);
 insert.run('error','a','bad','hash5','practice','error',70,80,CONFIG.practiceVersion);
 insert.run('another-person','b','other','hash6','practice','completed',75,85,CONFIG.practiceVersion);
 insert.run('old-benchmark','a','old retail','hash7','practice','completed',80,85,'retail-practice-v1');
 insert.run('old-suite-v1','a','old v1','hash8','practice','completed',81,86,'bfcl-travel-practice-v1');
 d.exec("UPDATE runs SET provider='openai',model='gpt-6-luna' WHERE id='latest-valid'");
 const frozen=d.prepare(FINAL_CANDIDATE_SQL).get('a',90,CONFIG.practiceVersion);
 assert.equal(frozen.id,'latest-valid');assert.equal(frozen.provider,'openai');assert.equal(frozen.model,'gpt-6-luna');
 assert.equal(d.prepare(FINAL_CANDIDATE_SQL).get('new-student',90,CONFIG.practiceVersion),undefined);d.close();
});
