-- R1-2 hardening, from the review of draft PR #9. The first R1-2 migration is already on staging and is
-- not edited; this one adds to it. Two changes, nothing else.

-- ---------------------------------------------------------------------------------------------
-- 1. Name length caps on the raw text
-- ---------------------------------------------------------------------------------------------
-- The existing name checks measure btrim(name), so a name of five million spaces and one letter passes.
-- These cap the raw length too. They are new named checks beside the old ones, which stay as they are.
-- Plain "add constraint" (validated at once) rather than "not valid" then "validate": it scans only
-- tutors, batches and students, which hold a handful of rows, and a row that really broke the cap
-- should stop the migration, not be hidden. The old checks already hold every name to 80 characters
-- once trimmed, so the only way a row breaks this one is padding of over 320 characters, which the
-- app never writes.
-- parent_name (80) and timings (100) are already capped on the raw length, so they need nothing.
alter table public.tutors
  add constraint tutors_name_raw_length_check
  check (name is null or char_length(name) <= 400);

alter table public.batches
  add constraint batches_name_raw_length_check
  check (char_length(name) <= 400);

alter table public.students
  add constraint students_name_raw_length_check
  check (char_length(name) <= 400);

-- ---------------------------------------------------------------------------------------------
-- 2. Column-level grants on batches, as on students
-- ---------------------------------------------------------------------------------------------
-- The table-wide insert and update let a client write id on update and created_at. Replace them.
-- tutor_id is not insertable: its default is auth.uid(), the client never sends it (R1-3 criterion 46),
-- and the batches_insert policy's with check still binds it to the session. id stays insertable because
-- the browser makes the id. Select and delete stay table-wide.
revoke insert, update on public.batches from authenticated;
grant insert (id, name, timings) on public.batches to authenticated;
grant update (name, timings) on public.batches to authenticated;
