# arthome-storefront-web

The **public storefront**, in **Next.js 16**. Search ranking and server rendering decide it: this is
a ticketing catalogue.

12 routes · a cart in three stages · an account in eleven sections

## Status

**Not started.** Tier 3 — one product, end to end. The whole use case: buying a seat, from the
storefront through to the payout.

## Where the design lives

The architecture, the interface contracts, the decisions and their reasons all live in
**[arthome-core](https://github.com/jubasse/arthome-core)**:

- `architecture/` — the context map, the data model, the event catalogue, the ADRs
- `openapi/` — the contracts of the two BFFs
- `proto/` — the Kafka event schemas
- `DECISIONS.md` — the arbitration log
- `architecture/critical-rules.md` — **re-read it every session**, nineteen lines

## Arthome

A streaming platform for live performance: ticketing, live, moderated chat, replays,
merchandise, artist payouts. Two products — a public storefront and a professional studio — across
five surfaces, served by seven microservices.
