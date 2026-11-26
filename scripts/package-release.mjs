import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { noLinks, planRelease, publishRelease, within } from './release-publisher.mjs';

const root = await fs.realpath('.');
const version = JSON.parse((await fs.readFile(path.join(root, 'package.json'), 'utf8')).replace(/^\uFEFF/, '')).version;
const plan = await planRelease(root, version);
const build = within(root, path.join(root, 'build'));
if (await fs.realpath(build) !== build) throw new Error('Unsafe build directory');
const dist = within(root, path.join(root, 'dist'));
await noLinks(dist);
await fs.access(path.join(dist, 'index.html'));
const marker = JSON.parse((await fs.readFile(path.join(dist, 'classquest-version.json'), 'utf8')).replace(/^\uFEFF/, ''));
if (marker.version !== version) throw new Error('Build the current app version before packaging');
await fs.access(path.join(build, 'launcher/Start.exe'));
const staging = within(root, await fs.mkdtemp(path.join(build, 'package-work-')));
let retainForRecovery = false;
try {
  const target = path.join(staging, 'ClassQuest');
  await fs.mkdir(target);
  for (const name of ['Start.exe', 'Start.staticwebassets.endpoints.json', 'web.config']) {
    try { await fs.copyFile(path.join(build, 'launcher', name), path.join(target, name)); }
    catch (error) { if (name === 'Start.exe' || error.code !== 'ENOENT') throw error; }
  }
  await fs.cp(dist, path.join(target, 'app'), { recursive: true });
  await fs.mkdir(path.join(target, 'data/backups'), { recursive: true });
  await fs.mkdir(path.join(target, 'licenses'));
  await fs.copyFile(path.join(root, 'docs/USER_GUIDE_VI.md'), path.join(target, 'README-VI.txt'));
  await fs.copyFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(target, 'THIRD_PARTY_NOTICES.txt'));
  await fs.copyFile(path.join(root, 'node_modules/three/LICENSE'), path.join(target, 'licenses/THREE-LICENSE.txt'));
  const gsapSource = await fs.readFile(path.join(root, 'node_modules/gsap/dist/gsap.js'), 'utf8');
  const gsapHeader = gsapSource.match(/\/\*![\s\S]*?\*\//)?.[0] ?? gsapSource.match(/\/\*[\s\S]*?\*\//)?.[0];
  if (!gsapHeader?.includes('gsap')) throw new Error('GSAP copyright header not found');
  await fs.writeFile(path.join(target, 'licenses/GSAP-NOTICE.txt'), gsapHeader + '\n\nStandard license: https://gsap.com/standard-license/\n');
  for (const name of ['LICENSE.txt', 'ThirdPartyNotices.txt']) {
    const runtimeNotice = path.join(process.env.ProgramFiles ?? 'C:/Program Files', 'dotnet', name);
    try { await fs.copyFile(runtimeNotice, path.join(target, 'licenses', `DOTNET-${name}`)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(root, 'scripts/create-release-zip.ps1'), '-SourcePath', target, '-ZipPath', path.join(staging, 'next.zip')], { windowsHide: true, stdio: 'inherit' });
  const result = await publishRelease(plan, staging);
  console.log(`Release candidate: ${result.zip} (${((await fs.stat(result.zip)).size / 1024 / 1024).toFixed(1)} MiB)`);
  if (plan.previousDirectory) console.log('Renamed the existing release directory and ZIP; class data and backups retained in place.');
} catch (error) {
  retainForRecovery = error instanceof AggregateError;
  if (retainForRecovery) console.error(`Keep recovery files: ${staging}`);
  throw error;
} finally {
  if (!retainForRecovery) { within(root, staging); await fs.rm(staging, { recursive: true }); }
}
