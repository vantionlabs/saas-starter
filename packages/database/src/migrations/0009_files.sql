-- What a tenant has uploaded.
--
-- The bytes live in object storage and this table is the index over them: what
-- the file is called, who put it there, and whether the upload ever finished.
-- Storage has no notion of a tenant, so the row is the only thing that knows.
create table if not exists "file" (
  "id" text not null primary key,
  "organizationId" text not null references "organization" ("id") on delete cascade,
  -- Where the bytes are, and prefixed with the organization deliberately: a
  -- bucket policy can be written against that prefix, so a mistake here is
  -- caught by storage as well as by row-level security.
  "key" text not null unique,
  "name" text not null,
  "contentType" text not null,
  "size" bigint not null default 0,
  -- `pending` until the upload is confirmed. A row is written *before* the
  -- bytes are sent, because the presigned URL has to name a key and the key has
  -- to be recorded against a tenant before anybody can write to it. An upload
  -- that is abandoned leaves a pending row and nothing else, which is a row to
  -- collect rather than a file nobody can account for.
  "status" text not null default 'pending',
  "uploadedBy" text references "user" ("id") on delete set null,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  constraint "file_status_check" check ("status" in ('pending', 'ready'))
);

create index if not exists "file_organizationId_idx" on "file" ("organizationId", "createdAt" desc);

alter table "file" enable row level security;
alter table "file" force row level security;
drop policy if exists "file_org_isolation" on "file";
create policy "file_org_isolation" on "file"
  using (
    "organizationId" = current_setting('app.current_org', true)
    or current_setting('app.worker', true) = 'on'
  )
  with check ("organizationId" = current_setting('app.current_org', true));
