# arthome-storefront-web

The Arthome storefront for the web: Next.js 16 App Router, server rendered for search ranking.

**Status: sign-in and live player.** `/sign-in` and `/live/<dateId>`, behind a same-origin proxy to the BFF. Everything else is still the placeholder home.

The domain, the architecture and the decisions live in
[arthome-core](https://github.com/jubasse/arthome-core).

## Getting started

Node 24 (`.nvmrc`) and pnpm 12 (`packageManager`, through Corepack).

```sh
git config core.hooksPath .githooks   # once after cloning
pnpm install
pnpm run dev                          # http://localhost:3000
```

## Running the live page

Every BFF call goes through `/api/*` on this app (`src/app/api/[...path]/route.ts`), which forwards `/v1/*` to
`BFF_URL` (`.env.example`, `http://localhost:3003`), so the session, CSRF, device and playback cookies are first-party.

1. Start the platform stack and the apps (the BFF on 3003).
2. Start the media stack (the edge on `http://localhost:58888`).
3. `pnpm run dev`, then open `http://localhost:3000/live/<dateId>`; it asks you to sign in first.

Open it on `localhost`, never `127.0.0.1`: the cookies are host-bound and the edge's CORS only allows the
`http://localhost:3000` origin.

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
`pnpm run check:core-specs` fails when the three do not name one release; CI runs it too.

## Hooks

`.githooks/` holds three hooks: `pre-commit` formats the staged files and runs `verify`,
`commit-msg` checks the subject line, `pre-push` runs `verify:full`.
