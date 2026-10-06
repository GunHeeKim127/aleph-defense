import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSessionAuth} from '../src/auth-session.mjs';
const origin='https://aleph-defense.vercel.app';
const config={publicAppUrl:origin,identityProvider:{issuer:'https://unit.supabase.co/auth/v1'}};
const authConfig={projectUrl:'https://unit.supabase.co',publishableKey:'unit-key'};
const fake={access_token:'unit-access',refresh_token:'unit-refresh',expires_in:3600};
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(data){this.data=data;return this}}}
function setup(){
  const calls=[];
  const clientFactory=()=>({auth:{
    signInWithPassword:async input=>{calls.push('login');return input.password==='unit-input'?{data:{session:fake}}:{error:{code:'invalid_credentials'}}},
    refreshSession:async()=>{calls.push('refresh');return {data:{session:fake}}},
    setSession:async()=>({data:{session:fake}}),signOut:async()=>{calls.push('logout');return {error:null}},
  }});
  return {...createSessionAuth({config,authConfig,clientFactory,
    verifierFactory:()=>async authorization=>authorization==='Bearer unit-access'?{userId:'unit-user'}:null}),calls};
}
test('SDK server login returns state only and secure HttpOnly cookies, then logout expires them',async()=>{
  const s=setup();let r=res();await s.handler({method:'POST',headers:{origin},body:{action:'login',email:'unit-input',password:'unit-input'}},r);
  assert.equal(r.code,200);assert.deepEqual(r.data,{authenticated:true});assert(!JSON.stringify(r.data).includes(fake.access_token));
  assert.equal(r.headers['Set-Cookie'].length,2);for(const cookie of r.headers['Set-Cookie'])assert.match(cookie,/Path=\/; HttpOnly; Secure; SameSite=Strict/);
  const cookie=r.headers['Set-Cookie'].map(c=>c.split(';')[0]).join('; ');
  r=res();await s.handler({method:'GET',headers:{cookie}},r);assert.deepEqual(r.data,{authenticated:true});
  r=res();await s.handler({method:'POST',headers:{origin,cookie},body:{action:'logout'}},r);assert.deepEqual(r.data,{authenticated:false});
  assert(s.calls.includes('logout'));assert(r.headers['Set-Cookie'].every(c=>c.endsWith('Max-Age=0')));
});
test('invalid login and cross-origin login do not expose credentials or create a session',async()=>{
  const s=setup();let r=res();await s.handler({method:'POST',headers:{origin},body:{action:'login',email:'unit-input',password:'wrong-unit-input'}},r);
  assert.equal(r.code,401);assert.equal(r.headers['Set-Cookie'],undefined);assert(!JSON.stringify(r.data).includes('wrong-unit-input'));
  r=res();await s.handler({method:'POST',headers:{origin:'https://outside.example'},body:{action:'login'}},r);assert.equal(r.code,403);
});
test('cookie wrapper verifies session, bearer flow remains intact, cookie mutations require same origin',async()=>{
  const s=setup();let received;
  const next=async(req,r)=>{received=req.headers.authorization;r.status(200).json({ok:true})};const h=s.wrap(next);
  let r=res();await h({method:'GET',headers:{cookie:'__Host-notes-access=unit-access'}},r);assert.equal(received,'Bearer unit-access');
  r=res();await h({method:'POST',headers:{authorization:'external-bearer'}},r);assert.equal(received,'external-bearer');
  r=res();await h({method:'POST',headers:{cookie:'__Host-notes-access=unit-access',origin:'https://outside.example'}},r);assert.equal(r.code,403);
});
test('refresh uses SDK, re-verifies new access token, and never returns it in JSON',async()=>{
  const s=setup(),r=res();await s.handler({method:'GET',headers:{cookie:'__Host-notes-refresh=unit-refresh'}},r);
  assert(s.calls.includes('refresh'));assert.deepEqual(r.data,{authenticated:true});assert(r.headers['Set-Cookie']);
  const empty=res();await s.handler({method:'GET',headers:{}},empty);assert.deepEqual(empty.data,{authenticated:false});
});
