import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { planRelease, publishRelease, within } from '../../scripts/release-publisher.mjs';

const workspace = path.resolve('.');
let root;
beforeEach(async () => {
  await fs.mkdir(path.join(workspace, 'build'), { recursive: true });
  root = await fs.mkdtemp(path.join(workspace, 'build', 'release-tests-'));
});
afterEach(async () => { within(workspace, root); await fs.rm(root, { recursive: true }); });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const psQuote = value => `'${value.replace(/'/g, "''")}'`;

async function program(directory, version) {
  await fs.mkdir(path.join(directory, 'app/assets'), { recursive: true });
  await fs.mkdir(path.join(directory, 'licenses'));
  await fs.writeFile(path.join(directory, 'Start.exe'), `synthetic executable ${version}`);
  await fs.writeFile(path.join(directory, 'app/index.html'), `synthetic app ${version}`);
  await fs.writeFile(path.join(directory, 'app/classquest-version.json'), JSON.stringify({ version }));
  await fs.writeFile(path.join(directory, 'app/assets', `${version}.js`), version);
  await fs.writeFile(path.join(directory, 'licenses/notice.txt'), 'synthetic license');
  await fs.writeFile(path.join(directory, 'README-VI.txt'), version);
  await fs.writeFile(path.join(directory, 'THIRD_PARTY_NOTICES.txt'), version);
}

async function installed() {
  const directory = path.join(root, 'release/ClassQuest-0.4.0'), app = path.join(directory, 'ClassQuest');
  await program(app, '0.4.0');
  await fs.mkdir(path.join(app, 'data/backups'), { recursive: true });
  await fs.writeFile(path.join(app, 'data/school-data.json'), '{"synthetic":"keep these exact bytes"}');
  await fs.writeFile(path.join(app, 'data/backups/legacy.json'), 'synthetic backup bytes');
  await fs.mkdir(path.join(app, 'data/profile-images'));
  await fs.mkdir(path.join(app, 'data/profile-backups'));
  await fs.writeFile(path.join(app, 'data/user-profile.json'), '{"synthetic":"teacher profile"}');
  await fs.writeFile(path.join(app, 'data/profile-images/logo.png'), 'synthetic original image');
  await fs.writeFile(path.join(app, 'data/profile-backups/previous.json'), 'synthetic profile backup');
  await fs.writeFile(path.join(root, 'release/Lop-Hoc-Vui-0.4.0-rc-win-x64.zip'), 'synthetic old archive');
  await fs.writeFile(path.join(root, 'release/Lop-Hoc-Vui-0.4.0-rc-win-x64.zip.sha256'), 'synthetic old checksum');
  return { directory, app };
}

async function staged(version = '0.5.0') {
  const staging = path.join(root, 'staging');
  await program(path.join(staging, 'ClassQuest'), version);
  await fs.writeFile(path.join(staging, 'next.zip'), 'synthetic new archive');
  return staging;
}

describe('release directory reuse', () => {
  it('renames the same existing directory and ZIP, replacing program files while preserving data and backups', async () => {
    const previous = await installed(), staging = await staged();
    const originalDirectory = await fs.stat(previous.directory), originalData = await fs.stat(path.join(previous.app, 'data/school-data.json'));
    const plan = await planRelease(root, '0.5.0');
    const result = await publishRelease(plan, staging);
    expect((await fs.stat(result.directory)).ino).toBe(originalDirectory.ino);
    const nextApp = path.join(result.directory, 'ClassQuest');
    expect((await fs.stat(path.join(nextApp, 'data/school-data.json'))).ino).toBe(originalData.ino);
    expect(await fs.readFile(path.join(nextApp, 'data/school-data.json'), 'utf8')).toBe('{"synthetic":"keep these exact bytes"}');
    expect(await fs.readFile(path.join(nextApp, 'data/backups/legacy.json'), 'utf8')).toBe('synthetic backup bytes');
    expect(await fs.readFile(path.join(nextApp, 'data/user-profile.json'), 'utf8')).toBe('{"synthetic":"teacher profile"}');
    expect(await fs.readFile(path.join(nextApp, 'data/profile-images/logo.png'), 'utf8')).toBe('synthetic original image');
    expect(await fs.readFile(path.join(nextApp, 'data/profile-backups/previous.json'), 'utf8')).toBe('synthetic profile backup');
    expect(await fs.readFile(path.join(nextApp, 'Start.exe'), 'utf8')).toContain('0.5.0');
    expect(await fs.readdir(path.join(nextApp, 'app/assets'))).toEqual(['0.5.0.js']);
    expect((await fs.readdir(path.join(root, 'release'))).sort()).toEqual(['ClassQuest-0.5.0', 'Lop-Hoc-Vui-0.5.0-rc-win-x64.zip', 'Lop-Hoc-Vui-0.5.0-rc-win-x64.zip.sha256']);
    expect(await fs.readFile(result.zip, 'utf8')).toBe('synthetic new archive');
    expect(await fs.readFile(result.zip + '.sha256', 'utf8')).toBe(`${hash('synthetic new archive')}  Lop-Hoc-Vui-0.5.0-rc-win-x64.zip\n`);
  });

  it('creates a directory only for the first release on a clean workspace', async () => {
    const result = await publishRelease(await planRelease(root, '0.5.0'), await staged());
    expect(await fs.readdir(path.join(result.directory, 'ClassQuest/data/backups'))).toEqual([]);
    expect((await fs.readdir(path.join(root, 'release'))).filter(name => name.startsWith('ClassQuest-'))).toEqual(['ClassQuest-0.5.0']);
  });

  it('rejects same versions, downgrades and malformed versions before changing the current release', async () => {
    await installed();
    for (const version of ['0.4.0', '0.3.9', '../escape', 'not-a-version']) await expect(planRelease(root, version)).rejects.toThrow();
    expect(await fs.readFile(path.join(root, 'release/Lop-Hoc-Vui-0.4.0-rc-win-x64.zip'), 'utf8')).toBe('synthetic old archive');
  });

  it('rejects multiple existing directories and never guesses which data to replace', async () => {
    await installed(); await fs.mkdir(path.join(root, 'release/ClassQuest-0.3.0'));
    await expect(planRelease(root, '0.5.0')).rejects.toThrow(/one existing/);
  });

  it('rejects a staged app with the wrong version before any directory rename', async () => {
    const previous = await installed(), plan = await planRelease(root, '0.5.0');
    await expect(publishRelease(plan, await staged('0.6.0'))).rejects.toThrow(/version/);
    expect((await fs.stat(previous.directory)).isDirectory()).toBe(true);
    expect(await fs.readFile(path.join(previous.app, 'data/backups/legacy.json'), 'utf8')).toBe('synthetic backup bytes');
  });

  it('rolls back all names and program/archive bytes if publishing fails after the old ZIP was renamed', async () => {
    const previous = await installed(), staging = await staged(), plan = await planRelease(root, '0.5.0');
    await expect(publishRelease(plan, staging, { move: async (from, to) => {
      if (from === path.join(staging, 'next.zip')) throw new Error('synthetic archive replacement failure');
      await fs.rename(from, to);
    } })).rejects.toThrow(/synthetic archive/);
    expect(await fs.readFile(path.join(previous.app, 'Start.exe'), 'utf8')).toContain('0.4.0');
    expect(await fs.readFile(path.join(previous.app, 'data/school-data.json'), 'utf8')).toBe('{"synthetic":"keep these exact bytes"}');
    expect(await fs.readFile(path.join(root, 'release/Lop-Hoc-Vui-0.4.0-rc-win-x64.zip'), 'utf8')).toBe('synthetic old archive');
    expect(await fs.readFile(path.join(root, 'release/Lop-Hoc-Vui-0.4.0-rc-win-x64.zip.sha256'), 'utf8')).toBe('synthetic old checksum');
    await expect(fs.stat(plan.directory)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects linked staging entries and paths outside the intended workspace', async () => {
    await installed(); const staging = await staged();
    const linked = path.join(root, 'outside'); await fs.mkdir(linked);
    await fs.writeFile(path.join(linked, 'sentinel.txt'), 'never change this');
    await fs.symlink(linked, path.join(staging, 'ClassQuest/app/linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(publishRelease(await planRelease(root, '0.5.0'), staging)).rejects.toThrow(/links/);
    expect(() => within(root, path.dirname(root))).toThrow(/workspace/);
    expect(await fs.readFile(path.join(linked, 'sentinel.txt'), 'utf8')).toBe('never change this');
  });

  it.skipIf(process.platform !== 'win32')('actual ZIP includes only program files and an empty backup directory, even with installed private data present', async () => {
    const { app } = await installed();
    await fs.writeFile(path.join(app, 'private-note.txt'), 'synthetic private content');
    const zip = path.join(root, 'archive.zip');
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(workspace, 'scripts/create-release-zip.ps1'), '-SourcePath', app, '-ZipPath', zip], { windowsHide: true });
    const inspect = `Add-Type -AssemblyName System.IO.Compression.FileSystem\n$archive=[System.IO.Compression.ZipFile]::OpenRead(${psQuote(zip)})\ntry { @($archive.Entries | ForEach-Object { $_.FullName }) | ConvertTo-Json -Compress } finally { $archive.Dispose() }`;
    const entries = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', inspect], { windowsHide: true, encoding: 'utf8' }).trim());
    expect(entries).toContain('ClassQuest/Start.exe'); expect(entries).toContain('ClassQuest/app/index.html');
    expect(entries.filter(name => name.startsWith('ClassQuest/data/'))).toEqual(['ClassQuest/data/backups/']);
    expect(entries.some(name => name.includes('school-data') || name.includes('legacy.json') || name.includes('private-note'))).toBe(false);
  });

  it.skipIf(process.platform !== 'win32')('the packaging CLI upgrades the existing release and removes its temporary workspace', async () => {
    await installed();
    await fs.mkdir(path.join(root, 'scripts')); await fs.mkdir(path.join(root, 'build/launcher'), { recursive: true });
    await fs.mkdir(path.join(root, 'docs')); await fs.mkdir(path.join(root, 'node_modules/three'), { recursive: true });
    await fs.mkdir(path.join(root, 'node_modules/gsap/dist'), { recursive: true });
    for (const script of ['package-release.mjs', 'release-publisher.mjs', 'create-release-zip.ps1', 'verify-release.ps1']) await fs.copyFile(path.join(workspace, 'scripts', script), path.join(root, 'scripts', script));
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '0.5.0', type: 'module' }));
    await fs.mkdir(path.join(root, 'dist'));
    await fs.writeFile(path.join(root, 'dist/index.html'), 'synthetic new frontend');
    await fs.writeFile(path.join(root, 'dist/classquest-version.json'), JSON.stringify({ version: '0.5.0' }));
    await fs.writeFile(path.join(root, 'build/launcher/Start.exe'), 'synthetic new executable');
    await fs.writeFile(path.join(root, 'docs/USER_GUIDE_VI.md'), 'synthetic guide');
    await fs.writeFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'synthetic notices');
    await fs.writeFile(path.join(root, 'node_modules/three/LICENSE'), 'synthetic fixture license');
    await fs.writeFile(path.join(root, 'node_modules/gsap/dist/gsap.js'), '/*! gsap synthetic fixture license */');
    const output = execFileSync(process.execPath, [path.join(root, 'scripts/package-release.mjs')], { cwd: root, windowsHide: true, encoding: 'utf8' });
    expect(output).toContain('Renamed the existing release directory and ZIP');
    const app = path.join(root, 'release/ClassQuest-0.5.0/ClassQuest');
    expect(await fs.readFile(path.join(app, 'Start.exe'), 'utf8')).toBe('synthetic new executable');
    expect(await fs.readFile(path.join(app, 'data/school-data.json'), 'utf8')).toBe('{"synthetic":"keep these exact bytes"}');
    expect(await fs.readFile(path.join(app, 'data/backups/legacy.json'), 'utf8')).toBe('synthetic backup bytes');
    const zip = path.join(root, 'release/Lop-Hoc-Vui-0.5.0-rc-win-x64.zip');
    expect(await fs.readFile(zip + '.sha256', 'utf8')).toContain(hash(await fs.readFile(zip)));
    expect(await fs.readdir(path.join(root, 'build'))).toEqual(['launcher']);
    expect((await fs.readdir(path.join(root, 'release'))).sort()).toEqual(['ClassQuest-0.5.0', 'Lop-Hoc-Vui-0.5.0-rc-win-x64.zip', 'Lop-Hoc-Vui-0.5.0-rc-win-x64.zip.sha256']);
    // The fake executable cannot run: archive-only verification must finish without starting it.
    const verify = () => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(root, 'scripts/verify-release.ps1'), '-ArchiveOnly'], { cwd: root, windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    expect(verify()).toContain('application was not started');
    await fs.writeFile(path.join(root, 'dist/index.html'), 'synthetic modified build');
    expect(verify).toThrow();
  });
});
