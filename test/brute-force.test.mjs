import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readAlerts, extractAlert } from '../xdr/brute-force/read-alerts.mjs';
import { decide } from '../xdr/brute-force/decide.mjs';
import { decision } from '../xdr/brute-force/classify.mjs';
import { askJev } from '../xdr/brute-force/jev.mjs';
import { connectResults, createXdrDecider } from '../xdr/brute-force/connect.mjs';
import { decide as originalDecide } from '../src/decider.mjs';

const fixture = JSON.parse(await readFile(new URL('../xdr/fixtures/brute-force.json', import.meta.url), 'utf8'));

// 원본 한 건당 추출 한 줄과 정확히 다섯 필드만 나오는지 확인합니다.
test('reader preserves count and excludes arbitrary secret fields and secret descriptions', async () => {
  const rows = await readAlerts();
  assert.equal(rows.length, fixture.alerts.length);
  assert.deepEqual(Object.keys(rows[0]), ['timestamp', 'sourceAddress', 'account', 'level', 'description']);
  const row = extractAlert({ timestamp: fixture.alerts[0].timestamp,
    data: { srcip: '192.0.2.1', srcuser: 'user01', password: 'sensitive-input' },
    rule: { level: 5, description: 'password=sensitive-input token=unit-value\nnext' } });
  assert(!JSON.stringify(row).includes('sensitive-input'));
  assert(!JSON.stringify(row).includes('unit-value'));
  assert(!row.description.includes('\n'));
});

// 임계값의 양쪽 경계와 Jev 미응답·비정상 응답을 검사합니다.
test('confidence boundaries and Jev timeout fail to alert, never fabricate responses', async () => {
  for (const [value, action] of [[0.49,'record'],[0.5,'alert'],[0.849,'alert'],[0.85,'block']]) {
    assert.equal(decision(value, 'pattern').action, action);
  }
  assert.equal(await askJev({}, () => new Promise(() => {}), 10), null);
  assert.equal(await askJev({}, () => ({ confidence: 2 })), null);
  assert.equal(await askJev({}, () => { throw Error('private-error'); }), null);
  assert.equal(await askJev({}, () => ({ confidence: 0.7 })), 0.7);
});

// 정상·명확·애매 경보를 실제 필드로 대조하고 경보 번호 변경에 영향을 받지 않는지 확인합니다.
test('fixture replay records normal events, blocks clear evidence, alerts ambiguity', async () => {
  const outcomes = await Promise.all(fixture.alerts.map(decide));
  const counts = { block:0, alert:0, record:0 };
  for (let i=0; i<outcomes.length; i++) {
    const output=outcomes[i]; counts[output.action]++;
    assert.deepEqual(Object.keys(output), ['action','confidence','reason']);
    assert(!output.reason.includes('\n'));
    if (fixture.alerts[i].rule.level <= 3) assert.equal(output.action, 'record');
    assert.deepEqual(await decide({ ...fixture.alerts[i], id: 'changed-id' }), output);
  }
  assert(counts.block > 0 && counts.alert > 0 && counts.record > 0);
  assert.equal(outcomes[0].action, 'block');
  assert.equal(outcomes[4].action, 'block');
  assert.equal(outcomes[10].action, 'alert');
  assert.equal(outcomes[19].action, 'record');
});

// 심판처럼 decide.mjs 한 파일만 빈 폴더에 복사해도 import와 판정이 끝나는지 확인합니다.
test('decide is a standalone offline module', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bf-isolated-'));
  try {
    const source = await readFile(new URL('../xdr/brute-force/decide.mjs', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /^\s*import\s/m);
    assert.doesNotMatch(source, /node:|readFile|writeFile|fetch\s*\(|process\.env|setTimeout/);
    const isolatedFile = join(dir, 'decide.mjs');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(isolatedFile, source, 'utf8');
    const isolated = await import(`${new URL(`file:///${isolatedFile.replace(/\\/g, '/')}`).href}?judge=1`);
    assert.equal(typeof isolated.decide, 'function');
    const outcomes = await Promise.all(fixture.alerts.map(alert => isolated.decide(alert)));
    assert.equal(outcomes[0].action, 'block');
    assert.equal(outcomes[4].action, 'block');
    assert.equal(outcomes[10].action, 'alert');
    assert.equal(outcomes[19].action, 'record');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// 만료·시작 시각·정상 신원·기존 판정 보존을 모두 검사합니다. 실제 운영 연결 시험이 아닙니다.
test('deny candidates have evidence and expiry; overlay preserves baseline and normal flow', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bf-test-'));
  try {
    const result = { decisions: await Promise.all(fixture.alerts.map(async a => ({ alertId:a.id, ...await decide(a) }))) };
    const rulesFile=join(dir,'rules.json'), alertsFile=join(dir,'alerts.log');
    const ingestedAt=Date.parse('2026-10-08T00:00:00.000Z');
    const rules=await connectResults(fixture,result,{rulesFile,alertsFile,clock:()=>ingestedAt});
    assert(rules.length > 0);
    assert(rules.every(r => Date.parse(r.expiresAt) - Date.parse(r.startsAt) === 900000));
    const log=(await readFile(alertsFile,'utf8')).trim().split('\n');
    assert.equal(log.length,result.decisions.filter(d=>d.action==='alert').length);
    assert(!log.join('').includes('srcuser'));
    const alert=fixture.alerts[0]; const at=ingestedAt+1000;
    const mapping=id=>id==='fixture-attack'?{sourceAddress:alert.data.srcip,account:'different-account'}
      :{sourceAddress:'192.0.2.60',account:'user01'};
    const request={schema:'aleph.decision.v1',requestId:'test-request',subjectId:'fixture-attack'};
    const baseDecide=async r=>({schema:r.schema,requestId:r.requestId,decision:'allow',reasonCode:'approved',ruleIds:[]});
    const overlay=createXdrDecider({baseDecide,resolveSubject:mapping,clock:()=>at,rulesFile});
    assert.equal((await overlay(request)).decision,'deny');
    assert.equal((await overlay({...request,subjectId:'fixture-normal'})).decision,'allow');
    const expiredAt=Math.max(...rules.map(rule=>Date.parse(rule.expiresAt)))+1;
    const expired=createXdrDecider({baseDecide,resolveSubject:mapping,clock:()=>expiredAt,rulesFile});
    assert.equal((await expired(request)).decision,'allow');
    const before=createXdrDecider({baseDecide,resolveSubject:mapping,clock:()=>ingestedAt-1,rulesFile});
    assert.equal((await before(request)).decision,'allow');
    const preserved=createXdrDecider({baseDecide:originalDecide,resolveSubject:mapping,clock:()=>at,rulesFile});
    assert.deepEqual(await preserved({...request,subjectId:'fixture-normal'}),await originalDecide(request));
    assert.throws(()=>createXdrDecider({baseDecide}),/trusted_mapping_required/);
    // Jev 점수만 높고 명확한 패턴 근거가 없는 경보는 자동 규칙으로 승격하지 않습니다.
    const ambiguous=fixture.alerts[10];
    const rejected=await connectResults({alerts:[ambiguous]}, {decisions:[{alertId:ambiguous.id,action:'block',confidence:0.99}]}, {rulesFile,alertsFile,clock:()=>ingestedAt});
    assert.equal(rejected.length,0);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
