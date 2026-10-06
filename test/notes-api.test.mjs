import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNotesHandler } from '../src/notes-api.mjs';
import { createLoginVerifier } from '../src/verify-login.mjs';
import { deploymentIdentity } from '../scripts/deployment-identity.mjs';
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
const id = '00000000-0000-4000-8000-000000000003';
const config = { publicAppUrl: 'https://aleph-defense.vercel.app',
  judgeIssuer: 'https://aleph-judge-production.up.railway.app/defense/judge',
  identityProvider: { issuer: 'https://unit.supabase.co/auth/v1', audience: 'authenticated',
    jwksUrl: 'https://unit.supabase.co/auth/v1/.well-known/jwks.json' } };
const env = { SUPABASE_URL: 'https://unit.supabase.co', SUPABASE_SECRET_KEY: 'unit-credential' };
function response() { return { headers: {}, setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(data){this.data=data;return this},end(){return this} }; }
function setup() {
  const rows = new Map(), calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    let result = [];
    const target = url.searchParams.get('id')?.slice(3);
    const owner = url.searchParams.get('owner_id')?.slice(3);
    if (options.method === 'POST') { const p = JSON.parse(options.body); rows.set(p.id,p); result=[p]; }
    else if (options.method === 'PATCH') { if (rows.has(target)) { Object.assign(rows.get(target),JSON.parse(options.body)); result=[rows.get(target)]; } }
    else if (options.method === 'DELETE') { if(rows.has(target)){result=[rows.get(target)];rows.delete(target)} }
    else result=[...rows.values()].filter(r => target ? r.id===target : r.owner_id===owner);
    return { ok:true,json:async()=>result.map(r=>({id:r.id,title:r.title,body:r.content,owner_id:r.owner_id})) };
  };
  const verifierFactory = () => async authorization => authorization === 'unit-a' ? {userId:a} : authorization === 'unit-b' ? {userId:b} : null;
  return { rows,calls, collection:createNotesHandler({config,env,fetchImpl,verifierFactory}),
    single:createNotesHandler({config,env,fetchImpl,verifierFactory,single:true}) };
}
async function call(handler, method, auth, body, target) {
  const res=response(); await handler({method,headers:auth?{authorization:auth}:{},body,query:{id:target}},res);return res;
}
test('missing or rejected identity returns JSON 401 without database access for every route', async()=>{
  const s=setup();
  for(const [handler,methods] of [[s.collection,['GET','POST']],[s.single,['GET','PUT','DELETE']]]) {
    for(const method of methods)for(const auth of [undefined,'invalid']) {
      const r=await call(handler,method,auth,{title:'unit',body:'unit'},id);assert.equal(r.code,401);assert.equal(typeof r.data.error,'string');
    }
  }
  assert.equal(s.calls.length,0);
});
test('CRUD assigns verified owner, ignores client role/user/owner, filters list, returns 404 after deletion',async()=>{
  const s=setup();
  let r=await call(s.collection,'POST','unit-a',{title:'unit',body:'unit',owner_id:b,userId:b,role:'admin'});
  assert.equal(r.code,201);const created=r.data.id;assert.match(created,/^[0-9a-f-]{36}$/);assert.equal(s.rows.get(created).owner_id,a);
  r=await call(s.collection,'GET','unit-a');assert.equal(r.data.length,1);assert.deepEqual(Object.keys(r.data[0]).sort(),['body','id','title']);
  r=await call(s.collection,'GET','unit-b');assert.deepEqual(r.data,[]);
  r=await call(s.single,'PUT','unit-a',{title:'changed',body:'changed',owner_id:b},created);assert.equal(r.data.title,'changed');assert.equal(s.rows.get(created).owner_id,a);
  r=await call(s.single,'GET','unit-a',undefined,created);assert.equal(r.code,200);
  r=await call(s.single,'DELETE','unit-a',undefined,created);assert.equal(r.code,204);
  r=await call(s.single,'GET','unit-a',undefined,created);assert.equal(r.code,404);
});
test('step 3 intentionally permits B access to A individual note; owner protection is deferred',async()=>{
  const s=setup();await call(s.collection,'POST','unit-a',{id,title:'unit',body:'unit'});
  assert.equal((await call(s.single,'GET','unit-b',undefined,id)).code,200);
  assert.equal((await call(s.single,'PUT','unit-b',{title:'unit-b',body:'unit-b'},id)).code,200);
  assert.equal((await call(s.single,'DELETE','unit-b',undefined,id)).code,204);
});
test('invalid IDs and bodies cannot reach DB, unsupported methods are rejected',async()=>{
  const s=setup();assert.equal((await call(s.single,'GET','unit-a',undefined,'bad')).code,400);
  assert.equal((await call(s.collection,'POST','unit-a',{id:'bad',title:'unit',body:'unit'})).code,400);
  assert.equal((await call(s.collection,'POST','unit-a',{title:'unit'})).code,400);
  assert.equal((await call(s.collection,'PUT','unit-a')).code,405);assert.equal(s.calls.length,0);
});
test('upstream failures never reveal credentials or upstream payload',async()=>{
  const h=createNotesHandler({config,env,verifierFactory:()=>async()=>({userId:a}),fetchImpl:async()=>{throw Error(env.SUPABASE_SECRET_KEY)}});
  const r=await call(h,'GET','unit-a');assert.equal(r.code,503);assert(!JSON.stringify(r.data).includes(env.SUPABASE_SECRET_KEY));
});
test('unchanged login verifier rejects absent and malformed tokens without trusting client input',async()=>{
  const verify=createLoginVerifier({config,supabaseClient:{auth:{getClaims(){throw Error('must not be called')}}}});
  assert.equal(await verify(undefined),null);assert.equal(await verify('invalid'),null);assert.equal(await verify('Bearer invalid'),null);
});
test('step 3 deployment identity continues to be generated from Vercel metadata',()=>{
  const identity=deploymentIdentity({VERCEL_GIT_PROVIDER:'github',VERCEL_GIT_REPO_OWNER:'GunHeeKim127',
    VERCEL_GIT_REPO_SLUG:'aleph-defense',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VERCEL_URL:'aleph-defense.vercel.app'},
    {...config,step:3,sampleMarker:'SAMPLE_NOTE_1'});
  assert.equal(identity.step,3);assert.equal(identity.commit,'a'.repeat(40));
});
