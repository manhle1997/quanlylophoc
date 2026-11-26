import { describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';
import { checkReleaseVersion, readReleaseVersion } from '../../scripts/check-release-version.mjs';

const source = () => ({ version: '1.2.3' });

describe('manual release source validation', () => {
  it('accepts a consistent source version without building or changing files', () => {
    const sources = source(), before = structuredClone(sources);
    expect(checkReleaseVersion(sources, '1.2.3')).toEqual({ version: '1.2.3', tag: 'v1.2.3', zipName: 'Lop-Hoc-Vui-1.2.3-rc-win-x64.zip' });
    expect(sources).toEqual(before);
  });
  it('uses package.json when the optional workflow input is blank or absent', () => {
    for (const value of [undefined, '']) expect(checkReleaseVersion(source(), value).version).toBe('1.2.3');
  });
  it('rejects ambiguous and path/shell-like version inputs before they reach a tag or command', () => {
    for (const value of ['v1.2.3', '01.2.3', '1.2.3-rc', '../escape', '1.2.3\n', '1.2.3; echo bad', '$(echo bad)']) expect(() => checkReleaseVersion(source(), value)).toThrow('Enter an exact version');
  });
  it('rejects a request for a version that has not been committed in the source', () => {
    expect(() => checkReleaseVersion(source(), '1.2.4')).toThrow('package.json');
  });
  it('rejects invalid canonical versions even without workflow input', () => {
    for (const version of [undefined, '', '1.2', 'v1.2.3', '01.2.3', '1.2.3-rc', '1.2.3\n']) expect(() => checkReleaseVersion({ version })).toThrow('package.json');
  });
  it('checks the actual current source versions', async () => {
    const root = path.resolve('.'), { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    expect((await readReleaseVersion(root, version)).version).toBe(version);
  });
  it('changing only package.json changes both the emitted web marker and native build version', async () => {
    const workspace = path.resolve('.');
    await fs.mkdir(path.join(workspace, 'build'), { recursive: true });
    const root = await fs.mkdtemp(path.join(workspace, 'build', 'version-tests-'));
    try {
      await fs.mkdir(path.join(root, 'scripts'));
      await fs.mkdir(path.join(root, 'launcher/ClassQuest.Launcher'), { recursive: true });
      for (const file of ['vite.config.js', 'scripts/check-release-version.mjs', 'launcher/ClassQuest.Launcher/ClassQuest.Launcher.csproj']) await fs.copyFile(path.join(workspace, file), path.join(root, file));
      await fs.writeFile(path.join(root, 'index.html'), '<!doctype html><title>Synthetic version fixture</title>');
      await fs.writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ version: '0.0.1' }));
      for (const version of ['2.7.4', '2.8.0']) {
        await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: "July's synthetic fixture", version, type: 'module' }));
        expect((await readReleaseVersion(root)).version).toBe(version);
        await build({ root, configFile: path.join(root, 'vite.config.js'), logLevel: 'silent' });
        const marker = JSON.parse(await fs.readFile(path.join(root, 'dist/classquest-version.json'), 'utf8'));
        expect(marker).toEqual({ app: 'ClassQuest', version, name: 'Lớp Học Vui' });
        const nativeVersion = execFileSync('dotnet', ['msbuild', path.join(root, 'launcher/ClassQuest.Launcher/ClassQuest.Launcher.csproj'), '-getProperty:Version', '-nodeReuse:false'], { windowsHide: true, encoding: 'utf8', env: { ...process.env, DOTNET_CLI_USE_MSBUILD_SERVER: '0' } }).trim();
        expect(nativeVersion).toBe(version);
      }
    } finally { if (!root.startsWith(path.join(workspace, 'build') + path.sep)) throw new Error('Unsafe version fixture cleanup'); await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
  }, 30000);
});
