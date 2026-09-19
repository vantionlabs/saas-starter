-- Runs once, the first time the compose volume is created.
--
-- `docker-entrypoint-initdb.d` scripts execute as the bootstrap superuser, which
-- is the only moment these roles can be made: creating one with BYPASSRLS needs
-- a superuser, and the application deliberately is not one.
--
-- Two roles, and the difference between them is the whole cross-tenant boundary:
--
--   vantion  what every application process connects as. NOBYPASSRLS, so a bug
--            in a handler that forgets `withOrgScope` reads nothing rather than
--            reading everybody. This is what `0002_rls.sql` has always assumed
--            and, until now, never actually got.
--
--   admin    the cross-tenant role, for the surface that must legitimately see
--            across organizations. Postgres enforces which process may do that,
--            rather than a lint rule or a reviewer.
--
-- CREATEROLE on `vantion` is for the test suite, which makes a role of its own
-- to assume. It is not a way back to bypassing: since Postgres 16 a CREATEROLE
-- role cannot grant an attribute it does not itself hold.

create role vantion login password 'vantion' nosuperuser nobypassrls createrole;
create role admin login password 'admin' nosuperuser bypassrls;

grant all on database vantion to vantion;
grant all on schema public to vantion;

grant connect on database vantion to admin;
grant usage on schema public to admin;

-- `vantion` runs the migrations and therefore owns the tables. Owning them is
-- not an exemption: every policy in this schema is FORCEd, which is what makes
-- the owner subject to it.
alter default privileges for role vantion in schema public
  grant select, insert, update, delete on tables to admin;
