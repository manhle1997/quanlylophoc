import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const programEntries = ['app', 'licenses', 'Start.exe', 'Start.staticwebassets.endpoints.json', 'web.config', 'README-VI.txt', 'THIRD_PARTY_NOTICES.txt'];
const exists = async target => { try { await fs.lstat(target); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };

export function within(root, target) {
  const absolute = path.resolve(target);
  if (!absolute.startsWith(path.resolve(root) + path.sep)) throw new Error('Release path must remain inside the workspace');
  return absolute;
}

export async function noLinks(target) {
  const info = await fs.lstat(target);
  if (info.isSymbolicLink()) throw new Error(`Release cannot contain links: ${path.basename(target)}`);
  if (info.isDirectory()) for (const name of await fs.readdir(target)) await noLinks(path.join(target, name));
}

export async function planRelease(workspace, version) {
  if (!versionPattern.test(version)) throw new Error('Invalid release version');
  const root = await fs.realpath(workspace), release = within(root, path.join(root, 'release'));
  if (await exists(release)) {
    const info = await fs.lstat(release);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Unsafe release directory');
  }
  const names = await exists(release) ? await fs.readdir(release, { withFileTypes: true }) : [];
  if (names.some(entry => entry.name.startsWith('ClassQuest-') && !entry.isDirectory())) throw new Error('Unsafe release entry');
  const folders = names.filter(entry => entry.isDirectory() && entry.name.startsWith('ClassQuest-'));
  if (folders.length > 1) throw new Error('Keep one existing release directory before updating');
  const previousVersion = folders[0]?.name.slice('ClassQuest-'.length);
  if (previousVersion && !versionPattern.test(previousVersion)) throw new Error('Invalid existing release version');
  if (previousVersion) {
    const oldParts = previousVersion.split('.').map(BigInt), newParts = version.split('.').map(BigInt);
    const firstDifference = newParts.findIndex((part, i) => part !== oldParts[i]);
    if (firstDifference < 0 || newParts[firstDifference] < oldParts[firstDifference]) throw new Error('Release version must increase; current release is preserved');
  }
  const directory = within(root, path.join(release, `ClassQuest-${version}`));
  const zip = within(root, path.join(release, `Lop-Hoc-Vui-${version}-rc-win-x64.zip`));
  for (const destination of [directory, zip, zip + '.sha256']) if (await exists(destination)) throw new Error('Release destination already exists');
  const previousDirectory = previousVersion ? within(root, path.join(release, folders[0].name)) : null;
  const previousZip = previousVersion ? within(root, path.join(release, `Lop-Hoc-Vui-${previousVersion}-rc-win-x64.zip`)) : null;
  if (previousDirectory) {
    const app = path.join(previousDirectory, 'ClassQuest');
    const info = await fs.lstat(app);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Unsafe installed directory');
    await noLinks(path.join(app, 'app')); await noLinks(path.join(app, 'Start.exe'));
    const marker = JSON.parse((await fs.readFile(path.join(app, 'app/classquest-version.json'), 'utf8')).replace(/^\uFEFF/, ''));
    if (marker.version !== previousVersion) throw new Error('Installed version does not match its directory name');
    if (await exists(path.join(app, 'licenses'))) await noLinks(path.join(app, 'licenses'));
    for (const name of programEntries) if (await exists(path.join(app, name))) {
      if ((await fs.lstat(path.join(app, name))).isSymbolicLink()) throw new Error('Unsafe installed program entry');
    }
    if (await exists(path.join(app, 'data')) && (await fs.lstat(path.join(app, 'data'))).isSymbolicLink()) throw new Error('Unsafe data directory');
    if (!await exists(previousZip) || !(await fs.lstat(previousZip)).isFile() || (await fs.lstat(previousZip)).isSymbolicLink()) throw new Error('Existing release ZIP is missing or unsafe');
    if (await exists(previousZip + '.sha256') && ((await fs.lstat(previousZip + '.sha256')).isSymbolicLink() || !(await fs.lstat(previousZip + '.sha256')).isFile())) throw new Error('Unsafe existing checksum');
    const executable = await fs.open(path.join(app, 'Start.exe'), 'r+'); await executable.close();
  }
  return { root, release, version, directory, zip, previousDirectory, previousZip };
}

// Only program files and archive names move. The installed data/ tree is never opened or copied.
export async function publishRelease(plan, staging, { move = fs.rename } = {}) {
  const { root, release, directory, zip, previousDirectory, previousZip } = plan;
  for (const target of [release, directory, zip, staging]) within(root, target);
  if (await fs.realpath(staging) !== path.resolve(staging)) throw new Error('Unsafe staging directory');
  const nextProgram = path.join(staging, 'ClassQuest'), nextZip = path.join(staging, 'next.zip');
  await noLinks(nextProgram); await noLinks(nextZip);
  await fs.access(path.join(nextProgram, 'app/index.html'));
  const marker = JSON.parse((await fs.readFile(path.join(nextProgram, 'app/classquest-version.json'), 'utf8')).replace(/^\uFEFF/, ''));
  if (marker.version !== plan.version) throw new Error('Staged app version does not match release version');
  await fs.access(path.join(nextProgram, 'Start.exe'));
  if (await exists(path.join(nextProgram, 'data')) && (await fs.readdir(path.join(nextProgram, 'data'))).some(name => name !== 'backups')) throw new Error('Staged release must not contain user data');
  if (await exists(path.join(nextProgram, 'data/backups')) && (await fs.readdir(path.join(nextProgram, 'data/backups'))).length) throw new Error('Staged backups must be empty');
  const checksum = createHash('sha256').update(await fs.readFile(nextZip)).digest('hex');
  await fs.writeFile(path.join(staging, 'next.sha256'), `${checksum}  ${path.basename(zip)}\n`);
  const undo = [], created = [];
  const rename = async (from, to) => {
    within(root, from); within(root, to);
    if (await exists(to)) throw new Error('Rename would overwrite an existing entry');
    await move(from, to); undo.push([to, from]);
  };
  await fs.mkdir(release, { recursive: true });
  await fs.mkdir(path.join(staging, 'previous'));
  try {
    if (previousDirectory) await rename(previousDirectory, directory);
    else { await fs.mkdir(directory); created.push(directory); await fs.mkdir(path.join(directory, 'ClassQuest')); created.push(path.join(directory, 'ClassQuest')); }
    const installed = path.join(directory, 'ClassQuest');
    for (const name of programEntries) {
      const current = within(root, path.join(installed, name));
      if (await exists(current)) await rename(current, path.join(staging, 'previous', name));
      const next = path.join(nextProgram, name);
      if (await exists(next)) await rename(next, current);
    }
    if (previousZip) {
      await rename(previousZip, zip);
      await rename(zip, path.join(staging, 'previous.zip'));
      if (await exists(previousZip + '.sha256')) {
        await rename(previousZip + '.sha256', zip + '.sha256');
        await rename(zip + '.sha256', path.join(staging, 'previous.sha256'));
      }
    }
    await rename(nextZip, zip); await rename(path.join(staging, 'next.sha256'), zip + '.sha256');
    if (!previousDirectory) await fs.mkdir(path.join(installed, 'data/backups'), { recursive: true });
    return { directory, zip, checksum };
  } catch (error) {
    try {
      for (const [from, to] of undo.reverse()) await fs.rename(from, to);
      for (const target of created.reverse()) { within(root, target); await fs.rm(target, { recursive: true }); }
    } catch (rollbackError) { throw new AggregateError([error, rollbackError], 'Release update could not roll back; retain staging for recovery'); }
    throw error;
  }
}
