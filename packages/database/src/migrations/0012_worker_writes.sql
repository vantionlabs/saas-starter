-- The worker could not write back what it had just read.
--
-- Two tables gave the worker an escape on `using` but not on `with check`, and
-- an UPDATE is checked by both. So the background half of this application
-- could read across tenants and then fail on every write back:
--
--   * `outboxEvent` — `Relay.run` claims a batch and cannot set `relayedAt`, so
--     every pass is refused and no job is ever delivered.
--   * `webhookEndpoint` — a delivery cannot clear or increment
--     `consecutiveFailures`, so a dead endpoint is never switched off and a
--     live one never has its counter reset.
--
-- Both report as a policy violation on a table the worker had just read from
-- perfectly well, which is the least helpful place to start looking.
--
-- It has never been seen, because the connection has always been able to bypass
-- row-level security entirely — which `0002_rls.sql` says in its own second
-- paragraph must never be true. Fixing the role is what surfaced this.
--
-- Split by command rather than widened, so the property that file states is
-- kept exactly: a scoped caller may only ever *insert* its own organization's
-- events, and the worker may only insert the org-less system ones. What the
-- worker gains is the ability to update what it is already allowed to read,
-- which is the whole of marking a row relayed.

drop policy if exists "outboxEvent_org_isolation" on "outboxEvent";

drop policy if exists "outboxEvent_select" on "outboxEvent";
create policy "outboxEvent_select" on "outboxEvent" for select
  using (
    "organizationId" = current_setting('app.current_org', true)
    or current_setting('app.worker', true) = 'on'
  );

-- Unchanged from 0006, and deliberately the strict one.
drop policy if exists "outboxEvent_insert" on "outboxEvent";
create policy "outboxEvent_insert" on "outboxEvent" for insert
  with check (
    "organizationId" = current_setting('app.current_org', true)
    or ("organizationId" is null and current_setting('app.worker', true) = 'on')
  );

-- The fix. `with check` matches `using`, because a worker that may see a row in
-- order to relay it must be able to say that it did.
drop policy if exists "outboxEvent_update" on "outboxEvent";
create policy "outboxEvent_update" on "outboxEvent" for update
  using (
    "organizationId" = current_setting('app.current_org', true)
    or current_setting('app.worker', true) = 'on'
  )
  with check (
    "organizationId" = current_setting('app.current_org', true)
    or current_setting('app.worker', true) = 'on'
  );

-- Only a scoped caller, within its own organization. Nothing deletes these
-- today — the row is the record that the job fired — so this is the narrow
-- option rather than the useful one on purpose.
drop policy if exists "outboxEvent_delete" on "outboxEvent";
create policy "outboxEvent_delete" on "outboxEvent" for delete
  using ("organizationId" = current_setting('app.current_org', true));


-- The same mistake, on the table a delivery has to write back to.
--
-- `0007_webhooks.sql` says "writes stay scoped, so no caller and no worker can
-- point another tenant's events at a URL of their choosing". That is about
-- *inserting* an endpoint, and it still holds below. Updating the failure count
-- of an endpoint the worker is already allowed to read is a different act, and
-- refusing it only means a receiver that has been gone for a week keeps costing
-- an attempt a minute.

drop policy if exists "webhookEndpoint_org_isolation" on "webhookEndpoint";

drop policy if exists "webhookEndpoint_select" on "webhookEndpoint";
create policy "webhookEndpoint_select" on "webhookEndpoint" for select
  using (
    "organizationId" = current_setting('app.current_org', true)
    or current_setting('app.worker', true) = 'on'
  );

-- Unchanged, and the one the original comment is about.
drop policy if exists "webhookEndpoint_insert" on "webhookEndpoint";
create policy "webhookEndpoint_insert" on "webhookEndpoint" for insert
  with check ("organizationId" = current_setting('app.current_org', true));

drop policy if exists "webhookEndpoint_update" on "webhookEndpoint";
create policy "webhookEndpoint_update" on "webhookEndpoint" for update
  using (
    "organizationId" = current_setting('app.current_org', true)
    or current_setting('app.worker', true) = 'on'
  )
  with check (
    "organizationId" = current_setting('app.current_org', true)
    or current_setting('app.worker', true) = 'on'
  );

drop policy if exists "webhookEndpoint_delete" on "webhookEndpoint";
create policy "webhookEndpoint_delete" on "webhookEndpoint" for delete
  using ("organizationId" = current_setting('app.current_org', true));
