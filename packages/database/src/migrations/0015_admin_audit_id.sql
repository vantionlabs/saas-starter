-- The staff trail records what was asked for, not what exists.
--
-- `0013_admin.sql` gave `adminAudit.organizationId` a foreign key with
-- `on delete set null`, reasoning that deleting an organization must not delete
-- the record of who looked at it. That was the right instinct and the wrong
-- mechanism: a foreign key also refuses an id that was *never* valid, and those
-- are the entries worth having most. Somebody probing identifiers, or following
-- a link to a tenant deleted last week, produced a constraint error instead of
-- a row — so the one read nobody could explain was the one read nobody could
-- see.
--
-- An audit row is a statement about the past. A foreign key makes it a
-- statement about the present, which is not the same thing and not what this
-- table is for.

alter table "adminAudit" drop constraint if exists "adminAudit_organizationId_fkey";
