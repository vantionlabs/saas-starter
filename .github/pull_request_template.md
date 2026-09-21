<!--
Thanks for sending this. The checklist is short on purpose — everything else is
checked by `bun run gate`, which CI runs for you.
-->

## What this changes

<!-- One or two sentences. If it fixes an issue, link it. -->

## Why

<!--
The reasoning, not the diff. This repository's own commits explain *why* a thing
is the way it is, because that is what a reader six months later needs and the
diff already shows the what.
-->

## Checklist

- [ ] `bun run gate` passes locally (format, check, lint, hygiene, tests, e2e)
- [ ] New tenant-owned tables have a row-level security policy **and** a case in
      `e2e/tests/tenancy.spec.ts` — that one is a breach rather than a bug
- [ ] New environment variables are in `.env.example`, with a line saying what
      happens when they are unset
- [ ] Anything that behaves differently now says so where it is documented

## Not required

- Commits do not need squashing; `main` is merged fast-forward.
- A failing `nightly` is not your problem unless you touched a Dockerfile or
  `apps/mobile`.
