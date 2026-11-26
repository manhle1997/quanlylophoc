import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { createDocument } from '../src/core/domain/schema.js';
import { upsertClass, addStudents } from '../src/core/domain/roster-service.js';
import { setAttendanceStatus, todayKey } from '../src/core/domain/attendance-service.js';
import { validateDocument } from '../src/core/domain/validation.js';
import { DEFAULT_PROFILE } from '../src/core/profile/profile-service.js';
import { createHash } from 'node:crypto';

const workspace = path.resolve('.'), root = path.join(workspace, 'build', 'Kiểm thử Class Quest', crypto.randomUUID());
if (!root.startsWith(workspace + path.sep)) throw new Error('Unsafe target');
const occupied = await new Promise(resolve => { const socket = net.connect(17844, '127.0.0.1'); socket.once('connect', () => { socket.destroy(); resolve(true); }); socket.once('error', () => resolve(false)); });
if (occupied) throw new Error('Port 17844 is occupied. Existing user application is preserved; do not run persistence tests against it.');
await fs.mkdir(root, { recursive: true });
await fs.cp(path.join(workspace, 'dist'), path.join(root, 'app'), { recursive: true });
await fs.copyFile(path.join(workspace, 'build/launcher/Start.exe'), path.join(root, 'Start.exe'));
await fs.mkdir(path.join(root, 'data'), { recursive: true });
await fs.writeFile(path.join(root, 'data', 'synthetic-secret.json'), '{"synthetic":"never serve this"}');
await fs.symlink(path.join(root, 'data'), path.join(root, 'app', 'outside'), 'junction');
const launch = () => spawn(path.join(root, 'Start.exe'), ['--no-browser', '--port=17844'], { cwd: workspace, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const request = (url = '/', { method = 'GET', host = '127.0.0.1:17844', headers = {}, body } = {}) => new Promise((resolve, reject) => {
  const req = http.request({ hostname: '127.0.0.1', port: 17844, path: url, method, headers: { Host: host, ...headers } }, response => { let text = ''; response.setEncoding('utf8'); response.on('data', chunk => { text += chunk; }); response.on('end', () => { let json; try { json = JSON.parse(text); } catch {} resolve({ status: response.statusCode, headers: response.headers, body: text, json }); }); }); req.on('error', reject); req.end(body);
});
const waitExit = child => child.exitCode !== null ? Promise.resolve(child.exitCode) : new Promise(resolve => child.once('exit', resolve));
const stop = async child => { if (child.exitCode === null) { const exit = waitExit(child); child.kill(); await exit; } };
const start = async () => {
  const child = launch(); let output = ''; child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
  for (let i = 0; i < 100; i++) { try { if ((await request('/classquest-version.json')).json?.version === '0.5.1') return child; } catch {} if (child.exitCode !== null) throw new Error(output); await new Promise(r => setTimeout(r, 100)); }
  await stop(child); throw new Error('Launcher did not become ready');
};
let child = await start();
try {
  const page = await request(); assert.equal(page.status, 200); assert.match(page.headers['content-security-policy'], /script-src 'self'/); assert.equal(page.headers['x-content-type-options'], 'nosniff');
  assert.equal((await request('/', { method: 'HEAD' })).body, ''); assert.equal((await request('/', { method: 'POST' })).status, 405); assert.equal((await request('/', { host: 'evil.test:17844' })).status, 400);
  const forbidden = ['/data/synthetic-secret.json', '/../data/synthetic-secret.json', '/%2e%2e/data/synthetic-secret.json', '/%252e%252e%252fdata/synthetic-secret.json', '/..%5cdata%5csynthetic-secret.json', '/outside/synthetic-secret.json', '/backups/x.json'];
  for (const url of forbidden) { const response = await request(url); assert.ok([400, 404].includes(response.status), `${url}: ${response.status}`); assert.ok(!response.body.includes('never serve this')); }
  let token = (await request('/api/session')).json.token;
  const auth = () => ({ 'X-ClassQuest-Token': token, Origin: 'http://127.0.0.1:17844', 'Content-Type': 'application/json' });
  const state = async () => request('/api/storage', { headers: auth() });
  const post = (document, expectedEtag, extra = {}) => request('/api/storage', { method: 'POST', headers: { ...auth(), ...extra }, body: JSON.stringify({ document, expectedEtag }) });
  assert.equal((await request('/api/storage')).status, 403);
  assert.equal((await request('/api/session', { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await state()).json.document, null);
  const doc = createDocument(), classId = upsertClass(doc, { name: 'Lớp giả tự lưu' }); addStudents(doc, classId, Array.from({ length: 40 }, (_, i) => `Học sinh giả ${i}`));
  setAttendanceStatus(doc, classId, todayKey(), doc.classes[0].students[0].id, 'absent');
  assert.equal((await post(doc, 'missing', { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post(doc, 'missing', { 'Content-Type': 'text/plain' })).status, 415);
  let result = await post(doc, 'missing'); assert.equal(result.status, 200, result.body); assert.equal(result.json.document.revision, 1);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'data/school-data.json'), 'utf8')).classes[0].students.length, 40);
  let etag = result.json.etag; doc.schoolName = 'Trường minh họa';
  assert.equal(result.json.document.schemaVersion, 2); assert.equal(result.json.document.attendanceRecords[0].entries[0].status, 'absent');
  const second = await post(doc, etag); assert.equal(second.status, 200, second.body); assert.equal(second.json.document.revision, 2);
  const repeated = await post(doc, etag); assert.equal(repeated.status, 200); assert.equal(repeated.json.etag, second.json.etag, 'Response-loss retry must be idempotent');
  doc.schoolName = 'Thay đổi chưa hợp nhất'; assert.equal((await post(doc, etag)).status, 409); assert.equal((await state()).json.document.schoolName, 'Trường minh họa');
  const invalid = structuredClone(doc); invalid.classes[0].students[0].id = 'duplicate'; invalid.classes[0].students[1].id = 'duplicate'; assert.equal((await post(invalid, second.json.etag)).status, 422);
  const invalidAttendance = structuredClone(doc); invalidAttendance.attendanceRecords[0].entries[0].studentId = 'missing'; assert.equal((await post(invalidAttendance, second.json.etag)).status, 422);
  for (const invalid of [
    d => { d.attendanceRecords[0].date = '2026-02-30'; },
    d => { d.attendanceRecords[0].entries[0].status = 'unknown'; },
    d => { d.attendanceRecords[0].entries.push(structuredClone(d.attendanceRecords[0].entries[0])); },
    d => { const record = structuredClone(d.attendanceRecords[0]); record.id = crypto.randomUUID(); d.attendanceRecords.push(record); },
    d => { delete d.attendanceRecords; },
  ]) {
    const malformed = structuredClone(doc); invalid(malformed);
    assert.equal((await post(malformed, second.json.etag)).status, 422);
    assert.equal((await state()).json.etag, second.json.etag, 'Rejected attendance must leave persisted bytes unchanged');
  }
  const backups = (await request('/api/storage/backups', { headers: auth() })).json.backups; assert.equal(backups.length, 1); assert.ok(!JSON.stringify(backups).includes(root));
  assert.equal(backups[0].attendanceDays, 1);
  const backupPath = path.resolve(root, 'data/backups'), preservedBackups = path.resolve(root, 'data/backups-preserved');
  assert.ok(backupPath.startsWith(root + path.sep) && preservedBackups.startsWith(root + path.sep));
  const beforeFailure = await fs.readFile(path.join(root, 'data/school-data.json'));
  await fs.rename(backupPath, preservedBackups); await fs.writeFile(backupPath, 'synthetic backup-location blocker');
  try { assert.equal((await post(doc, second.json.etag)).status, 503); assert.deepEqual(await fs.readFile(path.join(root, 'data/school-data.json')), beforeFailure); }
  finally { await fs.unlink(backupPath); await fs.rename(preservedBackups, backupPath); }
  await fs.chmod(path.join(root, 'data/school-data.json'), 0o444);
  try { assert.equal((await post(doc, second.json.etag)).status, 503); assert.deepEqual(await fs.readFile(path.join(root, 'data/school-data.json')), beforeFailure); }
  finally { await fs.chmod(path.join(root, 'data/school-data.json'), 0o666); }
  await fs.writeFile(path.join(root, 'data/school-data.json'), '{ damaged synthetic fixture');
  const damaged = await state(); assert.equal(damaged.status, 422); assert.equal((await post(doc, damaged.json.etag)).status, 422);
  assert.equal(await fs.readFile(path.join(root, 'data/school-data.json'), 'utf8'), '{ damaged synthetic fixture');
  result = await request('/api/storage/restore', { method: 'POST', headers: auth(), body: JSON.stringify({ backupId: backups[0].id, expectedEtag: damaged.json.etag }) }); assert.equal(result.status, 200, result.body); assert.equal(result.json.document.classes[0].students.length, 40);
  let saved = result.json.document; etag = result.json.etag;
  for (let i = 0; i < 23; i++) { saved.schoolName = `Trường giả ${i}`; result = await post(saved, etag); assert.equal(result.status, 200, result.body); saved = result.json.document; etag = result.json.etag; }
  assert.equal((await fs.readdir(path.join(root, 'data/backups'))).filter(n => n.startsWith('auto-v2-')).length, 20);
  const additional = launch(); additional.stdout.resume(); additional.stderr.resume(); assert.equal(await waitExit(additional), 0);
  await stop(child); child = await start(); token = (await request('/api/session')).json.token;
  const reopened = await state(); assert.equal(reopened.status, 200); assert.equal(reopened.json.etag, etag); assert.deepEqual(reopened.json.document, saved);
  const legacy = structuredClone(saved); legacy.schemaVersion = 1; delete legacy.attendanceRecords;
  const firstRound = legacy.rounds[0], previousWinner = legacy.classes[0].students[3].id;
  firstRound.calledStudentIds.push(previousWinner);
  legacy.history.push({ id: crypto.randomUUID(), playId: crypto.randomUUID(), classId, studentId: previousWinner, roundId: firstRound.roundId, gameId: 'fishing', mode: 'unique', revealedAt: new Date().toISOString() });
  const legacyBytes = JSON.stringify(legacy);
  await fs.writeFile(path.join(root, 'data/school-data.json'), legacyBytes);
  const oldState = await state(); assert.equal(oldState.status, 200); assert.equal(oldState.json.document.schemaVersion, 1);
  const migrated = validateDocument(oldState.json.document); const upgraded = await post(migrated, oldState.json.etag); assert.equal(upgraded.status, 200, upgraded.body); assert.equal(upgraded.json.document.schemaVersion, 2);
  for (const key of ['documentId', 'classes', 'rounds', 'history', 'settings']) assert.deepEqual(upgraded.json.document[key], legacy[key]);
  assert.deepEqual(upgraded.json.document.attendanceRecords, []);
  const backupFiles = await fs.readdir(path.join(root, 'data/backups'));
  assert.ok((await Promise.all(backupFiles.map(file => fs.readFile(path.join(root, 'data/backups', file), 'utf8')))).includes(legacyBytes), 'Upgrade must back up the exact legacy bytes');
  const future = structuredClone(upgraded.json.document); future.schemaVersion = 3; const futureBytes = JSON.stringify(future);
  await fs.writeFile(path.join(root, 'data/school-data.json'), futureBytes);
  assert.equal((await state()).json.code, 'FUTURE_SCHEMA');
  assert.equal((await post(migrated, upgraded.json.etag)).json.code, 'FUTURE_SCHEMA');
  assert.equal(await fs.readFile(path.join(root, 'data/school-data.json'), 'utf8'), futureBytes);
  const classBytes = await fs.readFile(path.join(root, 'data/school-data.json'));
  const profileState = () => request('/api/profile', { headers: auth() });
  const saveProfile = (profile, expectedEtag) => request('/api/profile', { method: 'POST', headers: auth(), body: JSON.stringify({ profile, expectedEtag }) });
  assert.equal((await profileState()).json.profile, null);
  assert.equal((await request('/api/profile')).status, 403);
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  const imageId = createHash('sha256').update(image).digest('hex') + '.png';
  const upload = (body, extra = {}) => request('/api/profile/images', { method: 'POST', headers: { ...auth(), 'Content-Type': 'image/png', ...extra }, body });
  assert.equal((await upload(image, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await request('/api/profile/images', { method: 'POST', body: image })).status, 403);
  assert.equal((await upload(Buffer.from('<svg/>'))).status, 415);
  assert.equal((await upload(Buffer.alloc(8 * 1024 * 1024 + 1))).status, 413);
  assert.equal((await upload(image)).json.imageId, imageId);
  assert.equal((await upload(image)).json.imageId, imageId);
  assert.deepEqual(await fs.readdir(path.join(root, 'data/profile-images')), [imageId]);
  assert.deepEqual(await fs.readFile(path.join(root, 'data/profile-images', imageId)), image);
  assert.equal((await request('/api/profile/images/' + imageId)).status, 403);
  assert.equal((await request('/data/profile-images/' + imageId)).status, 404);
  const fetched = await fetch('http://127.0.0.1:17844/api/profile/images/' + imageId, { headers: auth() });
  assert.equal(fetched.headers.get('Content-Type'), 'image/png'); assert.deepEqual(Buffer.from(await fetched.arrayBuffer()), image);
  const profile = { ...DEFAULT_PROFILE, teacherName: 'Giáo viên giả', schoolName: 'Trường minh họa', avatar: imageId, schoolLogo: imageId, accentColor: '#285d85' };
  const firstProfile = await saveProfile(profile, 'missing'); assert.equal(firstProfile.status, 200, firstProfile.body);
  assert.equal((await saveProfile({ ...profile, teacherName: 'Không ghi đè' }, 'missing')).status, 409);
  assert.equal((await saveProfile(profile, 'missing')).json.etag, firstProfile.json.etag);
  for (const patch of [{ avatar: '../school-data.json' }, { schoolLogo: 'https://evil.example/image.png' }, { accentColor: 'red' }, { teacherName: 'x'.repeat(121) }, { schemaVersion: 2 }, { avatar: '0'.repeat(64) + '.png' }]) assert.equal((await saveProfile({ ...profile, ...patch }, firstProfile.json.etag)).status, 422);
  const profileFile = path.join(root, 'data/user-profile.json'), profileBefore = await fs.readFile(profileFile);
  const profileBackups = path.join(root, 'data/profile-backups'), heldBackups = path.join(root, 'data/profile-backups-held');
  await fs.rename(profileBackups, heldBackups); await fs.writeFile(profileBackups, 'synthetic blocker');
  try { assert.equal((await saveProfile({ ...profile, subject: 'Chủ nhiệm' }, firstProfile.json.etag)).status, 503); assert.deepEqual(await fs.readFile(profileFile), profileBefore); }
  finally { await fs.unlink(profileBackups); await fs.rename(heldBackups, profileBackups); }
  const changedProfile = { ...profile, subject: 'Chủ nhiệm' };
  const secondProfile = await saveProfile(changedProfile, firstProfile.json.etag); assert.equal(secondProfile.status, 200, secondProfile.body);
  assert.deepEqual(await fs.readFile(path.join(profileBackups, (await fs.readdir(profileBackups))[0])), profileBefore);
  const heldImages = path.join(root, 'data/profile-images-held'); await fs.rename(path.join(root, 'data/profile-images'), heldImages);
  await fs.symlink(path.join(root, 'app'), path.join(root, 'data/profile-images'), 'junction');
  try { assert.equal((await upload(image)).status, 503); assert.equal((await request('/api/profile/images/' + imageId, { headers: auth() })).status, 503); }
  finally { await fs.unlink(path.join(root, 'data/profile-images')); await fs.rename(heldImages, path.join(root, 'data/profile-images')); }
  await stop(child); child = await start(); token = (await request('/api/session')).json.token;
  assert.deepEqual((await profileState()).json.profile, changedProfile);
  assert.deepEqual(await fs.readFile(path.join(root, 'data/school-data.json')), classBytes);
  const futureProfile = JSON.stringify({ ...changedProfile, schemaVersion: 2 }); await fs.writeFile(profileFile, futureProfile);
  assert.equal((await profileState()).json.code, 'FUTURE_SCHEMA'); assert.equal((await saveProfile(profile, secondProfile.json.etag)).json.code, 'FUTURE_SCHEMA'); assert.equal(await fs.readFile(profileFile, 'utf8'), futureProfile);
  console.log('PASS: separate profile JSON, exact image copy/deduplication/authenticated reads, restart, CAS/idempotency, validation/size/security, backup failure preservation and future schema; class bytes unchanged.');
  console.log('PASS: schema v1→v2 retains identities/history/rounds/settings and exact backup; daily attendance validation/restart/restore; future schema preserved; atomic writes, 20-backup retention, corrupt/conflict protection, idempotent retry, Host/Origin/token/content type, static traversal/junction isolation, Unicode path and CWD independence.');
} finally { await stop(child); }
const fake = http.createServer((_, res) => res.end('unrelated application'));
await new Promise(resolve => fake.listen(17844, '127.0.0.1', resolve));
try { const collision = launch(); collision.stdout.resume(); collision.stderr.resume(); assert.notEqual(await waitExit(collision), 0); console.log('PASS: unrelated port owner is never accepted.'); }
finally { await new Promise(resolve => fake.close(resolve)); }

