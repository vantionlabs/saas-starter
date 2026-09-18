-- The transactional outbox.
--
-- A row here is written in the same transaction as the change it describes, so
-- the two cannot disagree: no job fires for a write that rolled back, and no
-- committed write loses its job. A queue in Redis cannot offer that — enqueueing
-- there is a second system, and a crash between the two leaves one of them
-- wrong. The relay moves these rows into BullMQ afterwards, where scheduling,
-- retries and concurrency are better than anything worth rebuilding here.
create table if not exists "outboxEvent" (
  "id" text not null primary key,
  -- Nullable, because some events belong to the system rather than a tenant.
  -- Only the worker may write those; see the `with check` below.
  "organizationId" text references "organization" ("id") on delete cascade,
  "kind" text not null,
  "payload" jsonb not null,
  -- Carried on the row rather than looked up by kind, so the relay needs no
  -- registry and an event enqueued under one policy is not retried under a
  -- later one.
  "maxAttempts" integer not null default 5,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  -- Null until the relay has handed it to the queue. Kept rather than deleted,
  -- so "did this fire?" is answerable after the fact.
  "relayedAt" timestamptz
);

-- The relay's only query: the oldest unrelayed events. Partial, because the
-- relayed ones are the overwhelming majority and it never looks at them.
create index if not exists "outboxEvent_pending_idx"
  on "outboxEvent" ("createdAt") where "relayedAt" is null;
create index if not exists "outboxEvent_organizationId_idx" on "outboxEvent" ("organizationId");

alter table "outboxEvent" enable row level security;
alter table "outboxEvent" force row level security;
drop policy if exists "outboxEvent_org_isolation" on "outboxEvent";
-- Reading across tenants is the relay's whole job, so `using` has the worker
-- escape. Writing does not: a scoped caller may only ever write its own
-- organization's events, and the worker may additionally write the org-less
-- system ones. Neither can write into another tenant.
create policy "outboxEvent_org_isolation" on "outboxEvent"
  using (
    "organizationId" = current_setting('app.current_org', true)
    or current_setting('app.worker', true) = 'on'
  )
  with check (
    "organizationId" = current_setting('app.current_org', true)
    or ("organizationId" is null and current_setting('app.worker', true) = 'on')
  );
