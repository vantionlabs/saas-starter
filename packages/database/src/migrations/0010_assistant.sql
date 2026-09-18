-- A conversation with the assistant, and what was said in it.
--
-- Two tables for two different jobs. `message` is the product's record: what a
-- person asked, what they were told, in the order it happened, and it is what
-- the screen renders and what somebody reads back later.
create table if not exists "conversation" (
  "id" text not null primary key,
  "organizationId" text not null references "organization" ("id") on delete cascade,
  -- Whose conversation it is. An organization's members do not read each
  -- other's: the tools run as the *caller*, so a shared thread would show one
  -- person the results of another's permissions.
  "userId" text not null references "user" ("id") on delete cascade,
  "title" text not null default 'New conversation',
  /*
   * The model's working memory, as the provider's own encoded prompt.
   *
   * Deliberately opaque, and deliberately separate from `message`. Continuing a
   * conversation means handing back tool calls, tool results and approval
   * responses in the shape the library produced them; reconstructing that from
   * our own rows would be a second implementation of somebody else's protocol.
   *
   * It is a cache rather than a record: delete it and the conversation still
   * reads correctly, it just cannot be continued.
   */
  "state" jsonb not null default '[]'::jsonb,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz default CURRENT_TIMESTAMP not null
);

create index if not exists "conversation_organizationId_idx"
  on "conversation" ("organizationId", "userId", "updatedAt" desc);

create table if not exists "message" (
  "id" text not null primary key,
  "conversationId" text not null references "conversation" ("id") on delete cascade,
  "organizationId" text not null references "organization" ("id") on delete cascade,
  "role" text not null,
  "text" text not null,
  -- Named when the assistant used one, so the trail shows what it did rather
  -- than only what it said.
  "toolName" text,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  constraint "message_role_check" check ("role" in ('user', 'assistant', 'tool'))
);

create index if not exists "message_conversationId_idx"
  on "message" ("conversationId", "createdAt");

alter table "conversation" enable row level security;
alter table "conversation" force row level security;
drop policy if exists "conversation_org_isolation" on "conversation";
create policy "conversation_org_isolation" on "conversation"
  using (
    "organizationId" = current_setting('app.current_org', true)
    or current_setting('app.worker', true) = 'on'
  )
  with check ("organizationId" = current_setting('app.current_org', true));

alter table "message" enable row level security;
alter table "message" force row level security;
drop policy if exists "message_org_isolation" on "message";
create policy "message_org_isolation" on "message"
  using (
    "organizationId" = current_setting('app.current_org', true)
    or current_setting('app.worker', true) = 'on'
  )
  with check ("organizationId" = current_setting('app.current_org', true));
