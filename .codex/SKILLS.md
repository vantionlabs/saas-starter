# Skills

Codex reads `AGENTS.md` at the repository root; this file is the index of the skills
beside it. Each is prose about *this* repository, and which agent reads it is not the
skill's business — `.claude/skills` is a symlink to the same directory and
`.cursor/rules` is generated from it.

Read the matching `SKILL.md` before working in the area it names.

- **better-auth** — `.agents/skills/better-auth/SKILL.md`
  Use when touching authentication, organizations, members, invitations, roles, sessions, two-factor, single sign-on or SCIM provisioning in this repository. Covers which checks belong to better-auth and which belong to our policies, why a rule enforced on our side alone is one its own endpoints walk past, the `before`-hook pattern for plan gating, and the tables it owns and we must not write by hand.
- **brand-review** — `.agents/skills/brand-review/SKILL.md`
  Review content against your brand voice, style guide, and messaging pillars, flagging deviations by severity with specific before/after fixes. Use when checking a draft before it ships, when auditing copy for voice consistency and terminology, or when screening for unsubstantiated claims, missing disclaimers, and other legal flags.
- **campaign-plan** — `.agents/skills/campaign-plan/SKILL.md`
  Generate a full campaign brief with objectives, audience, messaging, channel strategy, content calendar, and success metrics. Use when planning a product launch, lead-gen push, or awareness campaign, when you need a week-by-week content calendar with dependencies, or when translating a marketing goal into a structured, executable plan.
- **competitive-brief** — `.agents/skills/competitive-brief/SKILL.md`
  Research competitors and generate a positioning and messaging comparison with content gaps, opportunities, and threats. Use when building sales battlecards, when finding positioning gaps and messaging angles competitors haven't claimed, or when a competitor makes a move and you need to assess the impact.
- **content-creation** — `.agents/skills/content-creation/SKILL.md`
  Draft marketing content across channels — blog posts, social media, email newsletters, landing pages, press releases, and case studies. Use when writing any marketing content, when you need channel-specific formatting, SEO-optimized copy, headline options, or calls to action.
- **draft-content** — `.agents/skills/draft-content/SKILL.md`
  Draft blog posts, social media, email newsletters, landing pages, press releases, and case studies with channel-specific formatting and SEO recommendations. Use when writing any marketing content, when you need headline or subject line options, or when adapting a message for a specific platform, audience, and brand voice.
- **effect-form-e2e** — `.agents/skills/effect-form-e2e/SKILL.md`
  Use when adding or changing a form, a field's validation rules, or a Playwright test in this repository. Covers why a form is effect-form and lives in the app rather than the design system, declaring field rules once in the contract, telling a validation failure apart from a refusal, and the e2e harness's rules — a user per test, waiting on a condition rather than sleeping.
- **effect-sql-rls** — `.agents/skills/effect-sql-rls/SKILL.md`
  Use when writing any query, migration, or test that touches tenant data in this repository. Covers withOrgScope and withWorkerScope, the two Postgres roles and why the boundary is in the database rather than in a lint rule, the shape a row-level security policy has to take, when Effect.orDie is right, and why a fixture seeds through the product's own write path.
- **email-sequence** — `.agents/skills/email-sequence/SKILL.md`
  Design and draft multi-email sequences with full copy, timing, branching logic, exit conditions, and performance benchmarks. Use when building onboarding, lead nurture, re-engagement, win-back, or product launch flows, when you need a complete drip campaign with A/B test suggestions, or when mapping a sequence end-to-end with a flow diagram.
- **impeccable** — `.agents/skills/impeccable/SKILL.md`
  Use when the user wants to design, redesign, shape, critique, audit, polish, clarify, distill, harden, optimize, adapt, animate, colorize, extract, or otherwise improve a frontend interface. Covers websites, landing pages, dashboards, product UI, app shells, components, forms, settings, onboarding, and empty states. Handles UX review, visual hierarchy, information architecture, cognitive load, accessibility, performance, responsive behavior, theming, anti-patterns, typography, fonts, spacing, layout, alignment, color, motion, micro-interactions, UX copy, error states, edge cases, i18n, and reusable design systems or tokens. Also use for bland designs that need to become bolder or more delightful, loud designs that should become quieter, live browser iteration on UI elements, or ambitious visual effects that should feel technically extraordinary. Not for backend-only or non-UI tasks.
- **performance-report** — `.agents/skills/performance-report/SKILL.md`
  Build a marketing performance report with key metrics, trend analysis, wins and misses, and prioritized optimization recommendations. Use when wrapping a campaign, when preparing weekly, monthly, or quarterly channel summaries for stakeholders, or when you need data translated into an executive summary with next-period priorities.
- **product-development** — `.agents/skills/product-development/SKILL.md`
  The four-phase product development workflow this repository is built for — discover, prototype, build, ship — what each phase produces, and the gates between them. Use when planning or running product work, when asked how long something will take, when deciding what to cut, or when a phase's slash command needs the method behind it.
- **seo-audit** — `.agents/skills/seo-audit/SKILL.md`
  Run a comprehensive SEO audit — keyword research, on-page analysis, content gaps, technical checks, and competitor comparison. Use when assessing a site's SEO health, when finding keyword opportunities and content gaps competitors own, or when you need a prioritized action plan split into quick wins and strategic investments.
- **tanstack-start-ssr** — `.agents/skills/tanstack-start-ssr/SKILL.md`
  Use when adding or changing a screen, route, loader, server function or data read in apps/web or apps/admin. Covers which half of the application a piece of work belongs to, hydration versus seeding an atom, why every server function is a GET, the one boundary at the root, createServerOnlyFn, and the trap where a control looks live and does nothing.

## Agents

Claude Code runs these as subagents through `.claude/agents`. Codex has no equivalent, so
they are listed here as **review checklists a person can drive by hand** — each one names a
property worth checking and the order to check it in.

- **contract-drift** — `.agents/agents/contract-drift.md`
  Checks a changed RPC contract, wire type or field schema against every consumer — the web atoms, the mobile app, the public v1 API, the agent toolkit and the MCP server. Use after editing anything in packages/modules/*/[A-Z]*Rpc.ts, packages/domain/src/api/v1/, or a Fields object. Returns the consumers that need changing.
- **design-sync** — `.agents/agents/design-sync.md`
  Sweeps apps/design, @vantion/ui and the real apps for drift between what a designer can see and what ships. Use after adding or changing a screen, a UI component, or a persona fixture, and before calling a slice done. Returns a short ordered list of divergences, not a file dump.
- **impeccable-asset-producer** — `.agents/agents/impeccable-asset-producer.md`
  Produces clean reusable raster assets from approved Impeccable mock references without redesigning the direction.
- **impeccable-documenter** — `.agents/agents/impeccable-documenter.md`
  Records DESIGN.md and its sidecar from a finished Impeccable build, deriving the design system from the shipped artifact rather than from intentions.
- **impeccable-finish-reviewer** — `.agents/agents/impeccable-finish-reviewer.md`
  Reviews a finished Impeccable build against its direction contract, the approved comp, and the chosen world's quality bar, returning an ordered list of material fixes.
- **impeccable-manual-edit-applier** — `.agents/agents/impeccable-manual-edit-applier.md`
  Applies leased Impeccable live manual copy-edit batches to source and returns canonical Apply results.
- **slice-gate** — `.agents/agents/slice-gate.md`
  Runs the gate and reads its output back as a ranked list of what to fix first. Use when a gate run has failed and the output is long, or before calling a slice done. Not for a clean run — it has nothing to add to "everything passed".
- **tenancy-review** — `.agents/agents/tenancy-review.md`
  Checks new or changed tables, policies, queries and tests against this repository's tenant-isolation rules. Use after a migration, after adding a store or a query that touches tenant data, and before calling any slice with a new table done. Returns a short ordered list; every finding is a potential breach rather than a bug.

Generated by `bun run agents` from `.agents/skills` and `.agents/agents`. Do not edit.
