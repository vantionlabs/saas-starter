-- Where a tenant wants its events delivered.
create table if not exists "webhookEndpoint" (
  "id" text not null primary key,
  "organizationId" text not null references "organization" ("id") on delete cascade,
  "url" text not null,
  -- Held in clear, unavoidably: signing a delivery needs the secret itself, not
  -- a hash of it. This is exactly why `auditableKeys` in the audit module is an
  -- allowlist — a webhook signing secret is the thing it exists to keep out of
  -- the log.
  "secret" text not null,
  -- Set false after too many consecutive failures, so a customer whose receiver
  -- has been gone for a week stops costing a delivery attempt every minute.
  "active" boolean not null default true,
  "consecutiveFailures" integer not null default 0,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null
);

create index if not exists "webhookEndpoint_organizationId_idx"
  on "webhookEndpoint" ("organizationId");

-- What was attempted, and what came back. Kept rather than deleted, because
-- "did you send it?" is the first question a customer asks and the last one a
-- queue can answer.
create table if not exists "webhookDelivery" (
  "id" text not null primary key,
  "organizationId" text not null references "organization" ("id") on delete cascade,
  "endpointId" text not null references "webhookEndpoint" ("id") on delete cascade,
  -- The outbox row this came from. A receiver dedupes on it, which is what makes
  -- at-least-once delivery something they can live with.
  "eventId" text not null,
  "kind" text not null,
  "status" text not null,
  "attempts" integer not null default 0,
  "responseStatus" integer,
  "lastError" text,
  "at" timestamptz default CURRENT_TIMESTAMP not null,
  constraint "webhookDelivery_status_check" check ("status" in ('pending', 'delivered', 'failed'))
);

create index if not exists "webhookDelivery_endpointId_idx" on "webhookDelivery" ("endpointId");
-- A receiver asking "did event X reach me?" and the worker checking whether it
-- has already tried both read this.
create unique index if not exists "webhookDelivery_event_endpoint_key"
  on "webhookDelivery" ("eventId", "endpointId");

alter table "webhookEndpoint" enable row level security;
alter table "webhookEndpoint" force row level security;
drop policy if exists "webhookEndpoint_org_isolation" on "webhookEndpoint";
-- The worker escape on `using` is what lets the delivery job find the endpoints
-- for an event before it has a scoped session. Writes stay scoped, so no caller
-- and no worker can point another tenant's events at a URL of their choosing.
create policy "webhookEndpoint_org_isolation" on "webhookEndpoint"
  using (
    "organizationId" = current_setting('app.current_org', true)
    or current_setting('app.worker', true) = 'on'
  )
  with check ("organizationId" = current_setting('app.current_org', true));

alter table "webhookDelivery" enable row level security;
alter table "webhookDelivery" force row level security;
drop policy if exists "webhookDelivery_org_isolation" on "webhookDelivery";
-- The worker writes these, so unlike every other table here its `with check`
-- has the escape too. It is still not a way into another tenant: the row's
-- organization comes from the endpoint the worker just read, not from a caller.
create policy "webhookDelivery_org_isolation" on "webhookDelivery"
  using (
    "organizationId" = current_setting('app.current_org', true)
    or current_setting('app.worker', true) = 'on'
  )
  with check (
    "organizationId" = current_setting('app.current_org', true)
    or current_setting('app.worker', true) = 'on'
  );
