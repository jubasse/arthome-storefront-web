import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { releaseAssetUrl, rewriteArthomeSpecs } from './arthome-specs.mjs';
import { findProblems } from './check-core-specs.mjs';
import { UseCoreError, checkAssetsExist, parseVersion } from './use-core.mjs';

const manifestFor = (version) => ({
  dependencies: {
    '@arthome/core': releaseAssetUrl('core', version),
    '@arthome/contracts': releaseAssetUrl('contracts', version),
    react: '19.3.0',
  },
  devDependencies: { '@arthome/tooling': releaseAssetUrl('tooling', version) },
});

describe('parseVersion', () => {
  it('accepts a release and strips a leading v', () => {
    expect(parseVersion('v0.4.0')).toBe('0.4.0');
    expect(parseVersion('0.4.0-rc.1')).toBe('0.4.0-rc.1');
  });

  it.each([undefined, '', '0.4', 'latest', '0.4.0/../x'])('refuses %j', (raw) => {
    expect(() => parseVersion(raw)).toThrow(UseCoreError);
  });
});

describe('checkAssetsExist', () => {
  it('fails with the URL of the missing asset', async () => {
    const fetchAsset = async (url) => ({ ok: !url.includes('contracts'), status: 404 });
    await expect(checkAssetsExist('9.9.9', undefined, fetchAsset)).rejects.toThrow(
      releaseAssetUrl('contracts', '9.9.9'),
    );
  });

  it('passes when every asset answers', async () => {
    await expect(
      checkAssetsExist('0.4.0', undefined, async () => ({ ok: true, status: 200 })),
    ).resolves.toBeUndefined();
  });
});

describe('rewriteArthomeSpecs', () => {
  const dirs = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true });
  });

  it('moves all three specs to the new version and leaves the rest alone', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'use-core-'));
    dirs.push(dir);
    const file = path.join(dir, 'package.json');
    fs.writeFileSync(file, JSON.stringify(manifestFor('0.3.0')));

    expect(rewriteArthomeSpecs((name) => releaseAssetUrl(name, '0.4.0'), file)).toBe(true);
    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(written).toEqual(manifestFor('0.4.0'));
    expect(rewriteArthomeSpecs((name) => releaseAssetUrl(name, '0.4.0'), file)).toBe(false);
  });
});

describe('findProblems', () => {
  it('accepts three specs on one release', () => {
    expect(findProblems(manifestFor('0.3.0')).problems).toEqual([]);
  });

  it('refuses two versions', () => {
    const manifest = manifestFor('0.3.0');
    manifest.dependencies['@arthome/core'] = releaseAssetUrl('core', '0.4.0');
    expect(findProblems(manifest).problems.join('\n')).toContain('2 versions');
  });

  it('refuses a spec that is not a release asset', () => {
    const manifest = manifestFor('0.3.0');
    manifest.dependencies['@arthome/core'] = 'file:../core.tgz';
    expect(findProblems(manifest).problems.join('\n')).toContain('expected a release asset URL');
  });

  it('refuses an asset naming another package', () => {
    const manifest = manifestFor('0.3.0');
    manifest.dependencies['@arthome/core'] = releaseAssetUrl('contracts', '0.3.0');
    expect(findProblems(manifest).problems.join('\n')).toContain('own package');
  });
});
