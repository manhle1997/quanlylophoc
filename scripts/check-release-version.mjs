import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function checkReleaseVersion(packageJson, requested) {
  const version = packageJson.version;
  if (typeof version !== 'string' || !versionPattern.test(version)) throw new Error('package.json must contain an exact x.y.z version, without v or extra characters.');
  // An optional expected version catches typos; it never overrides the source.
  if (requested !== undefined && requested !== '') {
    if (typeof requested !== 'string' || !versionPattern.test(requested)) throw new Error('Enter an exact version such as 1.2.3, without v or extra characters, or leave it blank to use package.json.');
    if (requested !== version) throw new Error(`package.json has version ${version}, but the requested release is ${requested}. Change package.json first, or leave the workflow version blank.`);
  }
  return { version, tag: `v${version}`, zipName: `Lop-Hoc-Vui-${version}-rc-win-x64.zip` };
}

export async function readReleaseVersion(root, requested) {
  const text = (await fs.readFile(path.join(root, 'package.json'), 'utf8')).replace(/^\uFEFF/, '');
  return checkReleaseVersion(JSON.parse(text), requested);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const plan = await readReleaseVersion(process.cwd(), process.env.RELEASE_VERSION);
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `version=${plan.version}\ntag=${plan.tag}\nzip_name=${plan.zipName}\n`);
  console.log(`Validated release source ${plan.tag} from package.json; no package was built.`);
}
