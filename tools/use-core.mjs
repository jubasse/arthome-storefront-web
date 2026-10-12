#!/usr/bin/env node
// use-core <version> [--from <releases-url>] — consume a released arthome-core.
//
// Points every @arthome/* dependency at the tarballs attached to the GitHub release
// v<version> of arthome-core and refreshes the lockfile (pnpm records the integrity of
// each URL). `--from` swaps the base URL, for a mirror or a local test server.

import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  ARTHOME_PACKAGES,
  CORE_RELEASES_URL,
  REPO,
  VERSION_PATTERN,
  releaseAssetUrl,
  rewriteArthomeSpecs,
} from './arthome-specs.mjs';

export class UseCoreError extends Error {}

export function parseVersion(raw) {
  const version = raw?.replace(/^v/, '');
  if (!version || !VERSION_PATTERN.test(version)) {
    throw new UseCoreError('usage: pnpm run use-core <version>   e.g. pnpm run use-core 0.4.0');
  }
  return version;
}

export async function checkAssetsExist(version, releasesUrl, fetchAsset = fetch) {
  for (const name of ARTHOME_PACKAGES) {
    const url = releaseAssetUrl(name, version, releasesUrl);
    const response = await fetchAsset(url, { method: 'HEAD' }).catch((error) => {
      throw new UseCoreError(`${url}: ${error}`);
    });
    if (!response.ok) {
      throw new UseCoreError(`${url} answered ${response.status}; is v${version} released?`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const fromIndex = args.indexOf('--from');
  const releasesUrl = fromIndex === -1 ? CORE_RELEASES_URL : args.splice(fromIndex, 2)[1];
  if (!releasesUrl) throw new UseCoreError('--from needs a URL');

  const version = parseVersion(args[0]);
  await checkAssetsExist(version, releasesUrl);

  const changed = rewriteArthomeSpecs((name) => releaseAssetUrl(name, version, releasesUrl));
  console.log(
    changed
      ? `use-core: package.json now points at arthome-core v${version}`
      : `use-core: package.json already pointed at arthome-core v${version}`,
  );

  execFileSync('pnpm', ['install'], { cwd: REPO, stdio: 'inherit' });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    if (!(error instanceof UseCoreError)) throw error;
    console.error(`use-core: ${error.message}`);
    process.exit(1);
  });
}
