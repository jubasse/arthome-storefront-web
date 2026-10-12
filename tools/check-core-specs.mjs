#!/usr/bin/env node
// check-core-specs — every @arthome/* dependency is a release asset of arthome-core,
// names its own package, and all of them name one version. Two versions would install
// two copies of the domain and break every instanceof.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  ARTHOME_PACKAGES,
  DEPENDENCY_FIELDS,
  REPO,
  parseReleaseAssetUrl,
} from './arthome-specs.mjs';

export function findProblems(manifest) {
  const problems = [];
  const versions = new Set();
  let checked = 0;

  for (const field of DEPENDENCY_FIELDS) {
    for (const name of ARTHOME_PACKAGES) {
      const spec = manifest[field]?.[`@arthome/${name}`];
      if (spec === undefined) continue;
      checked += 1;
      const at = `package.json -> ${field}.@arthome/${name}`;
      const asset = parseReleaseAssetUrl(spec);
      if (!asset) {
        problems.push(`${at}\n    is ${spec}, expected a release asset URL of arthome-core`);
      } else if (asset.name !== name || asset.tagVersion !== asset.fileVersion) {
        problems.push(
          `${at}\n    ${spec}\n    does not name its own package and one version; rewrite it with \`pnpm run use-core <version>\``,
        );
      } else {
        versions.add(asset.tagVersion);
      }
    }
  }

  if (versions.size > 1) {
    problems.push(
      `release specs name ${versions.size} versions of arthome-core: ${[...versions].join(', ')}\n    one release per repository; run \`pnpm run use-core <version>\``,
    );
  }
  return { problems, versions, checked };
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  const { problems, versions, checked } = findProblems(manifest);

  if (problems.length) {
    console.error('check-core-specs: FAIL');
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(`check-core-specs: ${checked} @arthome/* spec(s), release v${[...versions][0]}`);
  console.log('PASS every @arthome/* dependency points at one arthome-core release');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main());
