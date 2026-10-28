import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createClient} from '@libsql/client';

test('provider migration preserves legacy rows and can be safely rerun',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ku-agent-migration-')),url='file:'+join(dir,'legacy.db');
 let client=createClient({url});
 try{
  await client.execute('CREATE TABLE runs(id TEXT PRIMARY KEY,owner TEXT,kind TEXT,suite TEXT,status TEXT,score INTEGER,created INTEGER)');
  await client.execute("INSERT INTO runs VALUES('legacy','owner','practice','v1','completed',4,123)");
  client.close();
  for(let i=0;i<2;i++){
   const r=spawnSync(process.execPath,['scripts/migrate.mjs'],{env:{...process.env,TURSO_DATABASE_URL:url},encoding:'utf8'});
   assert.equal(r.status,0,r.stderr);
  }
  client=createClient({url});
  const row=(await client.execute('SELECT * FROM runs')).rows[0];
  assert.equal(row.score,4);assert.equal(row.status,'completed');assert.equal(row.provider,'school');assert.equal(row.model,'claude-haiku-5-5');
 }finally{client.close();await rm(dir,{recursive:true,force:true});}
});
