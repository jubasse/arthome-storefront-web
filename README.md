# arthome-storefront-web

The Arthome storefront for the web: Next.js 16 App Router, server rendered for search ranking.

**Status: scaffold.** One placeholder page, the gates and CI. Sign-in and the player come next.

The domain, the architecture and the decisions live in
[arthome-core](https://github.com/jubasse/arthome-core).

## Getting started

Node 24 (`.nvmrc`) and pnpm 12 (`packageManager`, through Corepack).

```sh
git config core.hooksPath .githooks   # once after cloning
pnpm install
pnpm run dev                          # http://localhost:3000
```

## Commands

- `pnpm run dev`, `build`, `start`: Next.js, all on port 3000.
- `pnpm run verify`: the gates (checks, Prettier, ESLint, TypeScript, Vitest). Cached; it runs on every commit.
- `pnpm run verify:full`: the same without caches. It runs before every push.
- `pnpm run format`: Prettier on the whole repository.
- `pnpm run test`: Vitest.

## Consuming arthome-core

`@arthome/tooling`, `@arthome/core` and `@arthome/contracts` are the tarballs attached to a GitHub
release of arthome-core, never a registry package.

```sh
pnpm run use-core 0.4.0
```

This checks that the release assets exist, rewrites the three specs in `package.json` and installs.
`pnpm run check:core-specs` fails when the three do not name one release; CI runs it with
`--require-release`.

## Hooks

`.githooks/` holds three hooks: `pre-commit` formats the staged files and runs `verify`,
`commit-msg` checks the subject line, `pre-push` runs `verify:full`.
