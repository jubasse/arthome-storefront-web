// What use-core and check-core-specs share: which dependencies are @arthome/*
// packages, and the shape of a release asset URL.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ARTHOME_PACKAGES = ['core', 'contracts', 'tooling'];
export const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];
export const CORE_RELEASES_URL = 'https://github.com/jubasse/arthome-core/releases/download';
export const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

export function releaseAssetUrl(name, version, releasesUrl = CORE_RELEASES_URL) {
  return `${releasesUrl}/v${version}/arthome-${name}-${version}.tgz`;
}

export function parseReleaseAssetUrl(spec) {
  const escaped = CORE_RELEASES_URL.replaceAll('.', '\\.');
  const match = new RegExp(`^${escaped}/v([^/]+)/arthome-([a-z]+)-([^/]+)\\.tgz$`).exec(spec);
  return match ? { tagVersion: match[1], name: match[2], fileVersion: match[3] } : null;
}

// Points every @arthome/* dependency of the manifest at specFor(name), and
// returns whether anything changed.
export function rewriteArthomeSpecs(specFor, manifestFile = path.join(REPO, 'package.json')) {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  let changed = false;

  for (const field of DEPENDENCY_FIELDS) {
    for (const dep of Object.keys(manifest[field] ?? {})) {
      const name = ARTHOME_PACKAGES.find((p) => `@arthome/${p}` === dep);
      if (!name) continue;
      const spec = specFor(name);
      if (manifest[field][dep] !== spec) {
        manifest[field][dep] = spec;
        changed = true;
      }
    }
  }

  if (changed) fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return changed;
}
