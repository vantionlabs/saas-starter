-- What an organization is paying for.
--
-- One row per organization, deliberately: a second subscription is an ambiguity
-- nobody wants to resolve at the point of checking whether a feature is on.
create table if not exists "subscription" (
  "organizationId" text not null primary key
    references "organization" ("id") on delete cascade,
  "stripeCustomerId" text not null,
  "stripeSubscriptionId" text,
  "plan" text not null default 'free',
  "status" text not null default 'active',
  -- Seats paid for, which is not seats used. The difference is what a seat
  -- limit is checked against.
  "seats" integer not null default 3,
  "currentPeriodEnd" timestamptz,
  "cancelAtPeriodEnd" boolean not null default false,
  "updatedAt" timestamptz default CURRENT_TIMESTAMP not null,
  constraint "subscription_plan_check" check ("plan" in ('free', 'pro', 'scale')),
  constraint "subscription_status_check"
    check ("status" in ('trialing', 'active', 'past_due', 'canceled', 'incomplete'))
);

create unique index if not exists "subscription_stripeCustomerId_key"
  on "subscription" ("stripeCustomerId");

-- Every Stripe event that has been handled, by Stripe's own id.
--
-- The idempotency ledger. Stripe redelivers, and `insert … on conflict do
-- nothing` returning zero rows is the signal that this one has already been
-- dealt with — which is cheaper and more honest than trying to make each
-- handler idempotent on its own.
create table if not exists "stripeEvent" (
  "id" text not null primary key,
  "type" text not null,
  "receivedAt" timestamptz default CURRENT_TIMESTAMP not null
);

alter table "subscription" enable row level security;
alter table "subscription" force row level security;
drop policy if exists "subscription_org_isolation" on "subscription";
-- The worker escape on `using` is what the Stripe webhook needs: it resolves the
-- organization *from* the customer id, which is precisely a cross-tenant read.
-- Writes carry it too, because the webhook is the only thing that writes here —
-- a customer cannot change their own plan by asking the API nicely.
create policy "subscription_org_isolation" on "subscription"
  using (
    "organizationId" = current_setting('app.current_org', true)
    or current_setting('app.worker', true) = 'on'
  )
  with check (current_setting('app.worker', true) = 'on');

-- Not tenant-scoped: an event arrives before its organization is known, and the
-- table holds nothing but Stripe's own ids.
alter table "stripeEvent" enable row level security;
alter table "stripeEvent" force row level security;
drop policy if exists "stripeEvent_worker_only" on "stripeEvent";
create policy "stripeEvent_worker_only" on "stripeEvent"
  using (current_setting('app.worker', true) = 'on')
  with check (current_setting('app.worker', true) = 'on');
