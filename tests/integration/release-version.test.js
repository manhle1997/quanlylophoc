import { describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { checkReleaseVersion, readReleaseVersion } from '../../scripts/check-release-version.mjs';

const source = () => ({
  packageJson: { version: '1.2.3' }, lockJson: { version: '1.2.3', packages: { '': { version: '1.2.3' } } }, webMarker: { version: '1.2.3' },
  launcherProject: '<Project><PropertyGroup><Version>1.2.3</Version></PropertyGroup></Project>',
  launcherProgram: String.raw`private const string Marker = "{\"app\":\"ClassQuest\",\"version\":\"1.2.3\"}";`,
  storageApi: 'new { token, version = "1.2.3", name = "Lớp Học Vui" }',
});

describe('manual release source validation', () => {
  it('accepts a consistent source version without building or changing files', () => {
    const sources = source(), before = structuredClone(sources);
    expect(checkReleaseVersion(sources, '1.2.3')).toEqual({ version: '1.2.3', tag: 'v1.2.3', zipName: 'Lop-Hoc-Vui-1.2.3-rc-win-x64.zip' });
    expect(sources).toEqual(before);
  });
  it('rejects missing, ambiguous and path/shell-like version inputs before they reach a tag or command', () => {
    for (const value of [undefined, '', 'v1.2.3', '01.2.3', '1.2.3-rc', '../escape', '1.2.3\n', '1.2.3; echo bad', '$(echo bad)']) expect(() => checkReleaseVersion(source(), value)).toThrow('Enter an exact version');
  });
  it('rejects a request for a version that has not been committed in the source', () => {
    expect(() => checkReleaseVersion(source(), '1.2.4')).toThrow('package.json');
  });
  it('refuses an old frontend, native launcher or API even if the archive could be renamed', () => {
    const edits = [
      s => { s.lockJson.version = '1.2.2'; }, s => { s.lockJson.packages[''].version = '1.2.2'; },
      s => { s.webMarker.version = '1.2.2'; }, s => { s.launcherProject = '<Version>1.2.2</Version>'; },
      s => { s.launcherProgram = s.launcherProgram.replace('1.2.3', '1.2.2'); }, s => { s.storageApi = s.storageApi.replace('1.2.3', '1.2.2'); },
    ];
    for (const edit of edits) { const sources = source(); edit(sources); expect(() => checkReleaseVersion(sources, '1.2.3')).toThrow('Update source versions'); }
  });
  it('checks the actual current source versions', async () => {
    const root = path.resolve('.'), { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    expect((await readReleaseVersion(root, version)).version).toBe(version);
  });
});
