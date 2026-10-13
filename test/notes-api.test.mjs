import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNotesHandler } from '../src/notes-api.mjs';
import { createAnnouncementsHandler } from '../src/announcements-api.mjs';
import { createLoginVerifier } from '../src/verify-login.mjs';
import { decide } from '../src/decider.mjs';
import { deploymentIdentity } from '../scripts/deployment-identity.mjs';
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
const id = '00000000-0000-4000-8000-000000000003';
const config = { publicAppUrl: 'https://aleph-defense.vercel.app',
  judgeIssuer: 'https://aleph-judge-production.up.railway.app/defense/judge',
  identityProvider: { issuer: 'https://unit.supabase.co/auth/v1', audience: 'authenticated',
    jwksUrl: 'https://unit.supabase.co/auth/v1/.well-known/jwks.json' } };
const env = { SUPABASE_URL: 'https://unit.supabase.co', SUPABASE_SECRET_KEY: 'unit-credential' };
// 서버 응답을 기록하는 시험용 객체를 만듭니다.
function response() { return { headers: {}, setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(data){this.data=data;return this},end(){return this} }; }
// 실제 DB나 계정 대신 모의 의존성을 연결해 시험 환경을 준비합니다.
function setup({ beforeMutation } = {}) {
  const rows = new Map(), calls = [];
  // 메모 저장소 동작을 모의 구현해 소유자 검사와 CRUD를 시험합니다.
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    let result = [];
    const target = url.searchParams.get('id')?.slice(3);
    const owner = url.searchParams.get('owner_id')?.slice(3);
    if (['PATCH','DELETE'].includes(options.method)) beforeMutation?.(rows, target);
    const permitted = rows.has(target) && (!owner || rows.get(target).owner_id === owner);
    if (options.method === 'POST') { const p = JSON.parse(options.body); if(rows.has(p.id))return {ok:false,status:409};rows.set(p.id,p); result=[p]; }
    else if (options.method === 'PATCH') { if (permitted) { Object.assign(rows.get(target),JSON.parse(options.body)); result=[rows.get(target)]; } }
    else if (options.method === 'DELETE') { if(permitted){result=[rows.get(target)];rows.delete(target)} }
    else result=[...rows.values()].filter(r => (!target || r.id===target) && (!owner || r.owner_id===owner));
    return { ok:true,json:async()=>result.map(r=>({id:r.id,title:r.title,body:r.content,owner_id:r.owner_id})) };
  };
  // 실제 토큰 대신 시험용 계정 식별 결과를 반환합니다.
  const verifierFactory = () => async authorization => authorization === 'unit-a' ? {userId:a} : authorization === 'unit-b' ? {userId:b} : null;
  return { rows,calls, collection:createNotesHandler({config,env,fetchImpl,verifierFactory}),
    single:createNotesHandler({config,env,fetchImpl,verifierFactory,single:true}) };
}
// 시험용 요청을 처리기에 전달하고 응답 결과를 반환합니다.
async function call(handler, method, auth, body, target) {
  const res=response(); await handler({method,headers:auth?{authorization:auth}:{},body,query:{id:target}},res);return res;
}
// 아래 이름에 명시된 동작과 거부 조건을 시험합니다.
test('missing or rejected identity returns JSON 401 without database access for every route', async()=>{
  const s=setup();
  for(const [handler,methods] of [[s.collection,['GET','POST']],[s.single,['GET','PUT','DELETE']]]) {
    for(const method of methods)for(const auth of [undefined,'invalid']) {
      const r=await call(handler,method,auth,{title:'unit',body:'unit'},id);assert.equal(r.code,401);assert.equal(typeof r.data.error,'string');
    }
  }
  assert.equal(s.calls.length,0);
});
// 아래 이름에 명시된 동작과 거부 조건을 시험합니다.
test('own CRUD assigns verified owner, ignores user/role, filters list, and returns 404 after deletion',async()=>{
  const s=setup();
  let r=await call(s.collection,'POST','unit-a',{title:'unit',body:'unit',userId:b,role:'admin'});
  assert.equal(r.code,201);const created=r.data.id;assert.match(created,/^[0-9a-f-]{36}$/);assert.equal(s.rows.get(created).owner_id,a);
  r=await call(s.collection,'GET','unit-a');assert.equal(r.data.length,1);assert.deepEqual(Object.keys(r.data[0]).sort(),['body','id','resourceId','title']);
  assert.equal(r.data[0].resourceId,`note:${created}`);
  r=await call(s.collection,'GET','unit-b');assert.deepEqual(r.data,[]);
  r=await call(s.single,'PUT','unit-a',{title:'changed',body:'changed'},created);assert.equal(r.data.title,'changed');assert.equal(s.rows.get(created).owner_id,a);
  r=await call(s.single,'GET','unit-a',undefined,created);assert.equal(r.code,200);
  r=await call(s.single,'DELETE','unit-a',undefined,created);assert.equal(r.code,204);
  r=await call(s.single,'GET','unit-a',undefined,created);assert.equal(r.code,404);
});
// 아래 이름에 명시된 동작과 거부 조건을 시험합니다.
test('A and B cannot read, modify, delete or take over each other notes',async()=>{
  const s=setup();await call(s.collection,'POST','unit-a',{id,title:'unit',body:'unit'});
  assert.equal((await call(s.single,'GET','unit-b',undefined,id)).code,403);
  assert.equal((await call(s.single,'PUT','unit-b',{title:'unit-b',body:'unit-b'},id)).code,403);
  assert.equal((await call(s.single,'DELETE','unit-b',undefined,id)).code,403);
  assert.equal((await call(s.collection,'POST','unit-b',{id,title:'unit-b',body:'unit-b'})).code,409);
  const other='00000000-0000-4000-8000-000000000005';await call(s.collection,'POST','unit-b',{id:other,title:'unit-b',body:'unit-b'});
  assert.equal((await call(s.single,'GET','unit-a',undefined,other)).code,403);
  assert.equal((await call(s.single,'PUT','unit-a',{title:'unit-a',body:'unit-a'},other)).code,403);
  assert.equal((await call(s.single,'DELETE','unit-a',undefined,other)).code,403);
  assert.equal((await call(s.single,'PUT','unit-b',{title:'own-b',body:'own-b'},other)).code,200);
  assert.equal((await call(s.single,'DELETE','unit-b',undefined,other)).code,204);
  assert.equal(s.rows.get(id).owner_id,a);assert.equal(s.rows.get(id).title,'unit');
});
// 판정기는 UUID 단건 경로를 통과시키고 최종 API가 저장된 소유자로 A와 B를 구분합니다.
test('normal UUID note reaches owner check while another user receives 403',async()=>{
  const s=setup();await call(s.collection,'POST','unit-a',{id,title:'unit',body:'unit'});
  const request={service:'notes',deviceRegistered:true,queryLength:0,subjectId:'opaque-subject',
    method:'GET',path:`/notes/${id}`,route:'GET /notes/:id',requestId:'stage8-owner-check'};
  assert.equal((await decide(request)).decision,'allow');
  assert.equal((await call(s.single,'GET','unit-a',undefined,id)).code,200);
  assert.equal((await call(s.single,'GET','unit-b',undefined,id)).code,403);
});
// 아래 이름에 명시된 동작과 거부 조건을 시험합니다.
test('client owner changes in POST/PUT/query are denied; NULL owners are denied',async()=>{
  const s=setup();
  assert.equal((await call(s.collection,'POST','unit-a',{title:'unit',body:'unit',owner_id:a})).code,403);
  await call(s.collection,'POST','unit-a',{id,title:'unit',body:'unit'});
  assert.equal((await call(s.single,'PUT','unit-a',{title:'unit',body:'unit',owner_id:b},id)).code,403);
  const r=response();await s.collection({method:'GET',headers:{authorization:'unit-a'},query:{owner_id:b}},r);assert.equal(r.code,403);
  const exportQuery=response();await s.collection({method:'GET',headers:{authorization:'unit-a'},query:{export:'csv'}},exportQuery);assert.equal(exportQuery.code,403);
  s.rows.get(id).owner_id=null;assert.equal((await call(s.single,'GET','unit-a',undefined,id)).code,403);
});
// 강사 공지는 검증된 강사이면서 저장된 작성자일 때만 수정할 수 있습니다.
test('announcement API separates resources and rejects menu/body role bypasses',async()=>{
  const row={id,title:'notice',content:'body',author_id:a};
  const fetchImpl=async(url,options)=>{
    if(options.method==='GET')return {ok:true,json:async()=>[{id:row.id,title:row.title,body:row.content,author_id:row.author_id}]};
    if(options.method==='PATCH'&&url.searchParams.get('author_id')===`eq.${a}`){Object.assign(row,JSON.parse(options.body));return {ok:true,json:async()=>[{id:row.id,title:row.title,body:row.content,author_id:row.author_id}]};}
    return {ok:true,json:async()=>[]};
  };
  const verifierFactory=()=>async auth=>auth==='instructor-a'?{userId:a,isInstructor:true}:auth==='student-b'?{userId:b,isInstructor:false}:null;
  const handler=createAnnouncementsHandler({config,env,fetchImpl,verifierFactory});
  let r=await call(handler,'GET','student-b',undefined,id);assert.equal(r.code,200);assert.equal(r.data.resourceId,`announcement:${id}`);
  r=await call(handler,'PUT','student-b',{title:'changed',body:'changed',role:'instructor'},id);assert.equal(r.code,403);
  r=await call(handler,'PUT','instructor-a',{title:'changed',body:'changed'},id);assert.equal(r.code,200);assert.equal(row.title,'changed');
  const query=response();await handler({method:'GET',headers:{authorization:'student-b'},query:{id,export:'csv'}},query);assert.equal(query.code,403);
});
// 아래 이름에 명시된 동작과 거부 조건을 시험합니다.
test('atomic owner filter prevents mutation when ownership changes between check and write',async()=>{
  for(const method of ['PUT','DELETE']) {
    // 시험 요청과 예상 응답을 구성합니다.
    const s=setup({beforeMutation:(rows,target)=>{rows.get(target).owner_id=b}});
    await call(s.collection,'POST','unit-a',{id,title:'unit',body:'unit'});
    const r=await call(s.single,method,'unit-a',method==='PUT'?{title:'changed',body:'changed'}:undefined,id);
    assert.equal(r.code,404);assert.equal(s.rows.get(id).title,'unit');assert.equal(s.rows.get(id).owner_id,b);
    // DB 변경 요청의 소유자 필터를 찾아 경합 시 보호 여부를 확인합니다.
    const mutation=s.calls.find(c=>c.options.method===(method==='PUT'?'PATCH':'DELETE'));assert.equal(mutation.url.searchParams.get('owner_id'),'eq.'+a);
  }
});
// 아래 이름에 명시된 동작과 거부 조건을 시험합니다.
test('invalid IDs and bodies cannot reach DB, unsupported methods are rejected',async()=>{
  const s=setup();assert.equal((await call(s.single,'GET','unit-a',undefined,'bad')).code,400);
  assert.equal((await call(s.collection,'POST','unit-a',{id:'bad',title:'unit',body:'unit'})).code,400);
  assert.equal((await call(s.collection,'POST','unit-a',{title:'unit'})).code,400);
  assert.equal((await call(s.collection,'PUT','unit-a')).code,405);assert.equal(s.calls.length,0);
});
// 아래 이름에 명시된 동작과 거부 조건을 시험합니다.
test('upstream failures never reveal credentials or upstream payload',async()=>{
  // 저장소 오류를 발생시키는 모의 처리기를 준비합니다.
  const h=createNotesHandler({config,env,verifierFactory:()=>async()=>({userId:a}),fetchImpl:async()=>{throw Error(env.SUPABASE_SECRET_KEY)}});
  const r=await call(h,'GET','unit-a');assert.equal(r.code,503);assert(!JSON.stringify(r.data).includes(env.SUPABASE_SECRET_KEY));
});
// 아래 이름에 명시된 동작과 거부 조건을 시험합니다.
test('unchanged login verifier rejects absent and malformed tokens without trusting client input',async()=>{
  const verify=createLoginVerifier({config,supabaseClient:{auth:{getClaims(){throw Error('must not be called')}}}});
  assert.equal(await verify(undefined),null);assert.equal(await verify('invalid'),null);assert.equal(await verify('Bearer invalid'),null);
});
// 아래 이름에 명시된 동작과 거부 조건을 시험합니다.
test('step 4 deployment identity continues to be generated from Vercel metadata',()=>{
  const identity=deploymentIdentity({VERCEL_GIT_PROVIDER:'github',VERCEL_GIT_REPO_OWNER:'GunHeeKim127',
    VERCEL_GIT_REPO_SLUG:'aleph-defense',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VERCEL_URL:'aleph-defense.vercel.app'},
    {...config,step:4,sampleMarker:'SAMPLE_NOTE_1'});
  assert.equal(identity.step,4);assert.equal(identity.commit,'a'.repeat(40));
});
// 아래 이름에 명시된 동작과 거부 조건을 시험합니다.
test('step 5 manifest includes data routes and a query-free HTTPS original API',()=>{
  const routes=['GET /api/notes','POST /api/notes','GET /api/notes/:id','PUT /api/notes/:id','DELETE /api/notes/:id'];
  const identity=deploymentIdentity({VERCEL_GIT_PROVIDER:'github',VERCEL_GIT_REPO_OWNER:'GunHeeKim127',
    VERCEL_GIT_REPO_SLUG:'aleph-defense',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VERCEL_URL:'aleph-defense.vercel.app'},
    {...config,step:5,sampleMarker:'SAMPLE_NOTE_1',allowedRoutes:routes,originalApiUrl:'https://unit.supabase.co/rest/v1/learning_notes'});
  assert.deepEqual(identity.allowedRoutes,routes);assert.equal(new URL(identity.originalApiUrl).search,'');assert.equal(identity.step,5);
});
// 6단계 이후에도 같은 Vercel 식별 계약과 5단계 자료 경로를 보존합니다.
test('step 6 deployment identity accepts the current defense stage',()=>{
  const routes=['GET /api/notes'];
  const identity=deploymentIdentity({VERCEL_GIT_PROVIDER:'github',VERCEL_GIT_REPO_OWNER:'GunHeeKim127',
    VERCEL_GIT_REPO_SLUG:'aleph-defense',VERCEL_GIT_COMMIT_SHA:'b'.repeat(40),VERCEL_URL:'aleph-defense.vercel.app'},
    {...config,step:6,sampleMarker:'SAMPLE_NOTE_1',allowedRoutes:routes,originalApiUrl:'https://unit.supabase.co/rest/v1/learning_notes'});
  assert.equal(identity.step,6);assert.deepEqual(identity.allowedRoutes,routes);assert.equal(identity.commit,'b'.repeat(40));
});
// 향후 단계는 50까지 허용하되 범위를 벗어나면 배포 식별 생성을 거부합니다.
test('deployment identity accepts stage 50 and rejects stage 51',()=>{
  const metadata={VERCEL_GIT_PROVIDER:'github',VERCEL_GIT_REPO_OWNER:'GunHeeKim127',
    VERCEL_GIT_REPO_SLUG:'aleph-defense',VERCEL_GIT_COMMIT_SHA:'c'.repeat(40),VERCEL_URL:'aleph-defense.vercel.app'};
  const future={...config,step:50,sampleMarker:'SAMPLE_NOTE_1',allowedRoutes:['GET /api/notes'],
    originalApiUrl:'https://unit.supabase.co/rest/v1/learning_notes'};
  assert.equal(deploymentIdentity(metadata,future).step,50);
  assert.throws(()=>deploymentIdentity(metadata,{...future,step:51}));
});
