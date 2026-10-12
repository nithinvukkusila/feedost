-- R1-9 Part A criteria 1, 2, 11 (docs/specs/R1-9-parent-pay-page.md, plan sections A3 and A5). public.consents has one
-- policy (select); a tutor reads only their own students' consents; no client can write at all (42501); anon has nothing;
-- the table holds no personal column; the composite foreign key, the unique key and the version check hold; deleting a
-- student or a tutor removes the consents.
-- Self-contained: makes its own users and rolls everything back. Fixtures are made as the test runner (the table owner).
begin;
select tests.assert_ready();
select plan(40);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
insert into public.students (id, tutor_id, name) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'A one'),
  ('a1000000-0000-4000-8000-000000000002', tests.tutor_a(), 'A two'),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'B one');
insert into public.consents (id, tutor_id, student_id, notice_version) values
  ('a5000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'v1'),
  ('a5000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'v1'),
  ('b5000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'v1');

-- Shape: row-level security, one policy
select ok((select relrowsecurity from pg_class where oid = 'public.consents'::regclass), 'row-level security is on for consents');
select is((select string_agg(policyname::text, ',' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'consents'), 'consents_select', 'consents_select is the only policy on consents');
select is((select cmd::text from pg_policies where schemaname = 'public' and tablename = 'consents' and policyname = 'consents_select'), 'SELECT', 'consents_select is for select');
select is((select roles::text from pg_policies where schemaname = 'public' and tablename = 'consents' and policyname = 'consents_select'), '{authenticated}', 'consents_select is for authenticated only');
select is((select array_agg(column_name::text order by column_name::text collate "C") from information_schema.columns where table_schema = 'public' and table_name = 'consents'),
  array['accepted_at','id','notice_version','student_id','tutor_id'], 'consents has exactly five columns and no phone, name or personal column');
select ok((select column_default is null from information_schema.columns where table_schema = 'public' and table_name = 'consents' and column_name = 'tutor_id'), 'consents.tutor_id has no default');
select ok((select is_nullable = 'NO' from information_schema.columns where table_schema = 'public' and table_name = 'consents' and column_name = 'tutor_id'), 'consents.tutor_id is not null');

-- Reads
select tests.act_as(tests.tutor_a());
select is((select count(*) from public.consents)::int, 2, 'A reads own two consents');
select tests.reset();
select tests.act_as(tests.tutor_b());
select is((select count(*) from public.consents)::int, 1, 'B reads only own consent');
select is((select count(*) from public.consents where tutor_id = tests.tutor_a())::int, 0, 'B reads none of A consents by tutor_id');
select is((select count(*) from public.consents where student_id = 'a1000000-0000-4000-8000-000000000001')::int, 0, 'B reads none of A consents by student_id');
select is((select count(*) from public.consents where notice_version = 'v1' and id = 'a5000000-0000-4000-8000-000000000001')::int, 0, 'B reads none of A consents by id and version');
select is((select count(*) from public.consents c join public.students s on s.id = c.student_id where s.tutor_id = tests.tutor_a())::int, 0, 'B reads none of A consents through a join');

-- B cannot write (the privilege check comes before row-level security)
select throws_ok($$insert into public.consents (tutor_id, student_id, notice_version) values (tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'v2')$$, '42501', null, 'B cannot insert a consent, not even for own student');
select throws_ok($$insert into public.consents (tutor_id, student_id, notice_version) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'v2')$$, '42501', null, 'B cannot insert a consent for A student');
select throws_ok($$update public.consents set notice_version = 'v9' where id = 'a5000000-0000-4000-8000-000000000001'$$, '42501', null, 'B cannot update A consent');
select throws_ok($$delete from public.consents where id = 'a5000000-0000-4000-8000-000000000001'$$, '42501', null, 'B cannot delete A consent');
select tests.reset();

-- A cannot write own consents either
select tests.act_as(tests.tutor_a());
select throws_ok($$insert into public.consents (tutor_id, student_id, notice_version) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'v2')$$, '42501', null, 'A cannot insert a consent');
select throws_ok($$update public.consents set notice_version = 'v9'$$, '42501', null, 'A cannot update a consent');
select throws_ok($$delete from public.consents$$, '42501', null, 'A cannot delete a consent');
select throws_ok($$truncate public.consents$$, '42501', null, 'A cannot truncate consents');
select tests.reset();

-- No session
select tests.act_as_anon();
select throws_ok($$select count(*) from public.consents$$, '42501', null, 'no session cannot select consents');
select throws_ok($$insert into public.consents (tutor_id, student_id, notice_version) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'v2')$$, '42501', null, 'no session cannot insert consents');
select throws_ok($$update public.consents set notice_version = 'v9'$$, '42501', null, 'no session cannot update consents');
select throws_ok($$delete from public.consents$$, '42501', null, 'no session cannot delete consents');
select tests.reset();

-- Privileges, read from the catalogue
select ok(has_table_privilege('authenticated', 'public.consents', 'select'), 'authenticated reads consents');
select ok(not has_table_privilege('authenticated', 'public.consents', 'insert,update,delete,truncate,references,trigger'), 'authenticated holds no write, truncate, references or trigger privilege on consents');
select ok(not has_any_column_privilege('authenticated', 'public.consents', 'insert,update,references'), 'authenticated holds no column privilege to write consents');
select ok(not has_table_privilege('anon', 'public.consents', 'select,insert,update,delete,truncate,references,trigger'), 'anon holds no privilege on consents');
select ok(not has_any_column_privilege('anon', 'public.consents', 'select,insert,update,references'), 'anon holds no column privilege on consents');

-- Constraints, as the table owner
select throws_ok($$insert into public.consents (tutor_id, student_id, notice_version) values (tests.tutor_a(), 'b1000000-0000-4000-8000-000000000001', 'v7')$$, '23503', null, 'a consent naming tutor A with tutor B student breaks the composite foreign key');
select throws_ok($$insert into public.consents (tutor_id, student_id, notice_version) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'v1')$$, '23505', null, 'the same student and version twice breaks the unique key');
select throws_ok($$insert into public.consents (tutor_id, student_id, notice_version) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', '')$$, '23514', null, 'an empty version is refused');
select throws_ok($$insert into public.consents (tutor_id, student_id, notice_version) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'abcdefghijklmnopq')$$, '23514', null, 'a 17 character version is refused');
select throws_ok($$insert into public.consents (tutor_id, student_id, notice_version) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'V2')$$, '23514', null, 'an uppercase version is refused');
select lives_ok($$insert into public.consents (tutor_id, student_id, notice_version) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'v2')$$, 'a second version for the same student is allowed');

-- Deleting a student removes its consents; deleting a tutor removes the rest
delete from public.students where id = 'a1000000-0000-4000-8000-000000000001';
select is((select count(*) from public.consents where student_id = 'a1000000-0000-4000-8000-000000000001')::int, 0, 'deleting a student removes its consents');
select is((select count(*) from public.consents where tutor_id = tests.tutor_a())::int, 1, 'and leaves the same tutor other students consents');
delete from auth.users where id = tests.tutor_a();
select is((select count(*) from public.consents where tutor_id = tests.tutor_a())::int, 0, 'deleting a tutor removes all their consents');
select is((select count(*) from public.consents where tutor_id = tests.tutor_b())::int, 1, 'and leaves the other tutor consents');

select * from finish();
rollback;
