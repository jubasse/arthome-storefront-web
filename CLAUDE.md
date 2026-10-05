# arthome-storefront-web

## Load the Next.js router before writing code — every session, without exception

**`nextjs-how-to`.** Load it at the start of any task that writes, reviews or debugs code here, and
load the skills it routes to. This includes the first task after a context compaction: a compacted
session keeps the conclusions and loses the reflex.

**Follow those skills to the letter.** They are the project's chosen best practices, not
suggestions, and they are more current than any model's memory of Next.js or React.

**The lesson this instruction comes from was paid for in another repository.** arthome-platform's
services were written without loading `nestjs-how-to`. The router's own rule is
`MUST load skills before writing code`, and when one of the routed skills was finally opened it
corrected two defects that were already committed. Skills trigger on their descriptions, and an
agent that believes it already knows the framework skips them.

## The domain is not defined here

Entities, vocabularies, error codes and boundary DTOs come from `@arthome/core` and
`@arthome/contracts`. The architecture, the ADRs and the arbitration log live in
**[arthome-core](https://github.com/jubasse/arthome-core)** — see `README.md`.

## Branches (D-087)

Nothing is committed on `main` or `develop`. Work goes on `feature/{name}` from `develop` and reaches
`develop` through a pull request; a release is `release/{version}` from `develop`, merged into `main`,
tagged `v{version}` and merged back, in the four repositories at once with one shared version. The
decision is arthome-core's D-087.

## Comments — delete by default

**The default is no comment.** Name it first: `waitUntilDue` needs no gloss, `handleRetryTiming`
needs one. Then comment only what a name cannot carry.

**The test**: would a reader with this code in front of them learn something they could not derive
from it?

**Keep** — a measured failure with what it cost · a constraint invisible at that line · a decision
and its reason · a warning where the obvious change is wrong.

**Delete** — a comment on trivial code (a delegate, a getter, a `findAll` calling `Model.findAll`) ·
a block above a name that already carries it · JSDoc restating the signature · narration of a
readable sequence · history · a default explained · prose about what the file does *not* do.

**No `⚠`, no emoji, no pictographic symbol anywhere** — comment, document, tool output (`✓`, `✗`,
`✅`, `❌`…). A warning is a sentence that says what breaks. Typographic punctuation (`→`, `—`, `§`)
is not concerned.

**TypeScript already documents the types, so JSDoc must not.** The signature gives the parameter
names, their types and the return type; repeating it is noise. JSDoc earns its place only for a
parameter whose **meaning** the type cannot give, or a **union return** — which branch comes back and
when. Never systematically.

**Where one line does, use one line, and give the scope rather than the whole story.** A surviving warning is two to four lines, never ten.

**Never delete a recorded measurement** — shorten its prose to one sentence, keep the fact.

`REPOSITORY_MAP.md` is generated from JSDoc, but each row also prints the **type signature**, so a
blank description is not a stranded reader. Same test as everywhere: a description earns its place by
saying what the name and the signature cannot.

**The mechanism that produces the problem**: paying yourself in comment lines for what the
discovery cost. That belongs in the commit message, not at the line.

Full rule, with four measured shapes: `code-conventions.md` §5.10.

## Pull requests and PR comments

**No `⚠`, no emoji, no pictographic symbol** — title, description, review comment, reply, and the
generated footer: write "Generated with Claude Code", without its emoji.

**Size it to the change.** Trivial: one or two sentences of context, then a bulleted list of what was
done. No dissertation. Otherwise add only what the diff cannot show: the risk, what was verified,
what was not.

Full rule: `code-conventions.md` §5.9.
