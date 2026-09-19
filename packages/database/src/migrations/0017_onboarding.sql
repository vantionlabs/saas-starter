-- Setting up a workspace, and where it got to.
--
-- On `organization` rather than on `user`, and that is the decision this table
-- is really about: in a B2B product the thing being set up is the *workspace*,
-- not the person. Keeping it per-user would onboard the second colleague to
-- join an organization that somebody else had already finished setting up —
-- asking them to name a company that already has a name.
--
-- Nullable rather than a boolean with a default, because three states matter
-- and a boolean carries two: never started, part-way through, and finished.
-- `onboardingStep` says which step is next; `onboardingCompletedAt` says it is
-- over and answers "when" for free, which a boolean never does.
--
-- No row-level security here for the same reason `organization` itself has
-- none: better-auth owns that table and writes it outside any scoped
-- transaction, and `0011_sso.sql` explains at length why a policy in the usual
-- shape would be an appearance of defence rather than the thing itself.

alter table "organization" add column if not exists "onboardingStep" text;
alter table "organization" add column if not exists "onboardingCompletedAt" timestamptz;

-- Everything that already exists was set up by hand and is not waiting for a
-- wizard. Without this, every organization in an existing database would be
-- sent to onboarding on the next deploy — which is how a migration that means
-- to add a feature takes the product away from everybody using it.
update "organization"
  set "onboardingCompletedAt" = now()
  where "onboardingCompletedAt" is null and "createdAt" < now();
