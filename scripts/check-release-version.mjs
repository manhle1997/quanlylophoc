import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function checkReleaseVersion(sources, requested) {
  if (typeof requested !== 'string' || requested !== requested.trim() || !versionPattern.test(requested)) throw new Error('Enter an exact version such as 0.5.1, without v or extra characters.');
  const checks = {
    'package.json': sources.packageJson.version,
    'package-lock.json': sources.lockJson.version,
    'package-lock.json root package': sources.lockJson.packages?.['']?.version,
    'web version marker': sources.webMarker.version,
    'launcher project': sources.launcherProject.match(/<Version>([^<]+)<\/Version>/)?.[1],
    'launcher identity marker': sources.launcherProgram.match(/\\"version\\":\\"([^"\\]+)\\"/)?.[1],
    'launcher session API': sources.storageApi.match(/version\s*=\s*"([^"]+)"/)?.[1],
  };
  for (const [name, actual] of Object.entries(checks)) {
    if (actual !== requested) throw new Error(`${name} has version ${actual ?? '(missing)'}, but the requested release is ${requested}. Update source versions before releasing.`);
  }
  return { version: requested, tag: `v${requested}`, zipName: `Lop-Hoc-Vui-${requested}-rc-win-x64.zip` };
}

export async function readReleaseVersion(root, requested) {
  const read = name => fs.readFile(path.join(root, name), 'utf8').then(text => text.replace(/^\uFEFF/, ''));
  const [packageJson, lockJson, webMarker, launcherProject, launcherProgram, storageApi] = await Promise.all([
    read('package.json'), read('package-lock.json'), read('public/classquest-version.json'),
    read('launcher/ClassQuest.Launcher/ClassQuest.Launcher.csproj'),
    read('launcher/ClassQuest.Launcher/Program.cs'), read('launcher/ClassQuest.Launcher/StorageApi.cs'),
  ]);
  return checkReleaseVersion({ packageJson: JSON.parse(packageJson), lockJson: JSON.parse(lockJson), webMarker: JSON.parse(webMarker), launcherProject, launcherProgram, storageApi }, requested);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const plan = await readReleaseVersion(process.cwd(), process.env.RELEASE_VERSION);
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `version=${plan.version}\ntag=${plan.tag}\nzip_name=${plan.zipName}\n`);
  console.log(`Validated release source ${plan.tag}; no package was built.`);
}
