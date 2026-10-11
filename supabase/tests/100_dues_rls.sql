-- R1-5 criteria 8 to 12 (docs/specs/R1-5-dues.md section 4 and plan section 5). public.dues has one policy (select),
-- a tutor reads only their own dues, no client can write at all (42501 on insert, update and delete), anon has
-- nothing, and the functions that write dues cannot be run by clients except ensure_my_dues, which signed-in
-- tutors may. Self-contained: makes its own users and rolls everything back. Cross-tutor reads run as the
-- attacker (B); fixtures are made as the test runner.
begin;
select tests.assert_ready();
select plan(48);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
insert into public.students (id, tutor_id, name) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'A one'),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'B one');
insert into public.dues (id, tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values
  ('a2000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 120000, 0, 'due', '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'opening', null, 50000, 0, 'due', '2026-10-12'),
  ('b2000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 90000, 0, 'due', '2026-10-05');

select ok((select relrowsecurity from pg_class where oid = 'public.dues'::regclass), 'row-level security is on for dues');
select is((select string_agg(policyname::text, ',' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'dues'), 'dues_select', 'dues_select is the only policy');
select is((select cmd::text from pg_policies where schemaname = 'public' and tablename = 'dues' and policyname = 'dues_select'), 'SELECT', 'dues_select is for select');
select is((select roles::text from pg_policies where schemaname = 'public' and tablename = 'dues' and policyname = 'dues_select'), '{authenticated}', 'dues_select is for authenticated only');

-- Reads
select tests.act_as(tests.tutor_a());
select is((select count(*) from public.dues)::int, 2, 'A reads own two dues');
select tests.reset();
select tests.act_as(tests.tutor_b());
select is((select count(*) from public.dues)::int, 1, 'B reads only own due');
select is((select count(*) from public.dues where tutor_id = tests.tutor_a())::int, 0, 'B reads none of A dues by tutor_id');
select is((select count(*) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001')::int, 0, 'B reads none of A dues by student_id');
select is((select count(*) from public.dues where id = 'a2000000-0000-4000-8000-000000000001')::int, 0, 'B reads none of A dues by id');
select is((select count(*) from public.dues where kind = 'opening')::int, 0, 'B reads none of A opening dues by kind');

select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, status, due_date) values (tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'monthly', '2026-09-01', 1000, 'due', '2026-09-05')$$, '42501', null, 'B cannot insert a due, not even for own student');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-09-01', 1000, 'due', '2026-09-05')$$, '42501', null, 'B cannot insert a due for A student');
select tests.reset();

-- A cannot write a due in any way (the column privilege check comes before row-level security)
select tests.act_as(tests.tutor_a());
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-09-01', 1000, 'due', '2026-09-05')$$, '42501', null, 'A cannot insert a due with own tutor_id and own student');
select throws_ok($$insert into public.dues (student_id, kind, month, amount, status, due_date) values ('a1000000-0000-4000-8000-000000000001', 'monthly', '2026-09-01', 1000, 'due', '2026-09-05')$$, '42501', null, 'A cannot insert a due without a tutor_id');
select throws_ok($$update public.dues set amount = amount + 1 where id = 'a2000000-0000-4000-8000-000000000001'$$, '42501', null, 'A cannot update amount');
select throws_ok($$update public.dues set amount_paid = amount where id = 'a2000000-0000-4000-8000-000000000001'$$, '42501', null, 'A cannot update amount_paid');
select throws_ok($$update public.dues set status = 'paid' where id = 'a2000000-0000-4000-8000-000000000001'$$, '42501', null, 'A cannot update status');
select throws_ok($$update public.dues set due_date = '2026-01-01' where id = 'a2000000-0000-4000-8000-000000000001'$$, '42501', null, 'A cannot update due_date');
select throws_ok($$update public.dues set tutor_id = tests.tutor_b() where id = 'a2000000-0000-4000-8000-000000000001'$$, '42501', null, 'A cannot update tutor_id');
select throws_ok($$delete from public.dues where id = 'a2000000-0000-4000-8000-000000000001'$$, '42501', null, 'A cannot delete a due');
select tests.reset();

-- No session
select tests.act_as_anon();
select throws_ok($$select count(*) from public.dues$$, '42501', null, 'no session cannot select');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-09-01', 1000, 'due', '2026-09-05')$$, '42501', null, 'no session cannot insert');
select throws_ok($$update public.dues set amount = 1$$, '42501', null, 'no session cannot update');
select throws_ok($$delete from public.dues$$, '42501', null, 'no session cannot delete');
select throws_ok($$select public.ensure_my_dues()$$, '42501', null, 'no session cannot run ensure_my_dues');
select tests.reset();

-- Privileges, read from the catalogue
select ok(has_table_privilege('authenticated', 'public.dues', 'select'), 'authenticated reads dues');
select ok(not has_table_privilege('authenticated', 'public.dues', 'insert,update,delete,truncate,references,trigger'), 'authenticated holds no write, truncate, references or trigger privilege on dues');
select ok(not has_any_column_privilege('authenticated', 'public.dues', 'insert,update,references'), 'authenticated holds no column privilege to write dues');
select ok(not has_table_privilege('anon', 'public.dues', 'select,insert,update,delete,truncate,references,trigger'), 'anon holds no privilege on dues');
select ok(not has_any_column_privilege('anon', 'public.dues', 'select,insert,update,references'), 'anon holds no column privilege on dues');

-- Functions: only ensure_my_dues is for clients
select ok(not has_function_privilege('anon', 'public.generate_dues(timestamptz)', 'execute') and not has_function_privilege('authenticated', 'public.generate_dues(timestamptz)', 'execute'), 'neither anon nor authenticated can execute generate_dues(timestamptz)');
select ok(not has_function_privilege('anon', 'public.create_dues_for(timestamptz, uuid)', 'execute') and not has_function_privilege('authenticated', 'public.create_dues_for(timestamptz, uuid)', 'execute'), 'neither anon nor authenticated can execute create_dues_for(timestamptz, uuid)');
select ok(not has_function_privilege('anon', 'public.create_missing_opening_dues(timestamptz)', 'execute') and not has_function_privilege('authenticated', 'public.create_missing_opening_dues(timestamptz)', 'execute'), 'neither anon nor authenticated can execute create_missing_opening_dues(timestamptz)');
select ok(not has_function_privilege('anon', 'public.india_day(timestamptz)', 'execute') and not has_function_privilege('authenticated', 'public.india_day(timestamptz)', 'execute'), 'neither anon nor authenticated can execute india_day(timestamptz)');
select ok(not has_function_privilege('anon', 'public.sync_opening_due()', 'execute') and not has_function_privilege('authenticated', 'public.sync_opening_due()', 'execute'), 'neither anon nor authenticated can execute sync_opening_due()');
select ok(has_function_privilege('authenticated', 'public.ensure_my_dues()', 'execute'), 'authenticated can execute ensure_my_dues');
select ok(not has_function_privilege('anon', 'public.ensure_my_dues()', 'execute'), 'anon cannot execute ensure_my_dues');
select tests.act_as(tests.tutor_a());
select throws_ok($$select public.generate_dues()$$, '42501', null, 'a tutor cannot call generate_dues()');
select throws_ok($$select public.generate_dues('2026-10-12 05:00+00')$$, '42501', null, 'a tutor cannot call generate_dues with a date');
select throws_ok($$select public.create_dues_for(now(), null)$$, '42501', null, 'a tutor cannot call create_dues_for');
select throws_ok($$select public.sync_opening_due()$$, '42501', null, 'a tutor cannot call sync_opening_due');
select throws_ok($$select public.create_missing_opening_dues(now())$$, '42501', null, 'a tutor cannot call create_missing_opening_dues');
select throws_ok($$select public.india_day(now())$$, '42501', null, 'a tutor cannot call india_day');
select tests.reset();

-- The writers run as their owner with a fixed search_path
select ok((select prosecdef and coalesce(proconfig::text, '') like '%search_path%' from pg_proc where oid = 'public.ensure_my_dues()'::regprocedure), 'ensure_my_dues() is security definer with a fixed search_path');
select ok((select prosecdef and coalesce(proconfig::text, '') like '%search_path%' from pg_proc where oid = 'public.generate_dues(timestamptz)'::regprocedure), 'generate_dues(timestamptz) is security definer with a fixed search_path');
select ok((select prosecdef and coalesce(proconfig::text, '') like '%search_path%' from pg_proc where oid = 'public.create_dues_for(timestamptz, uuid)'::regprocedure), 'create_dues_for(timestamptz, uuid) is security definer with a fixed search_path');
select ok((select prosecdef and coalesce(proconfig::text, '') like '%search_path%' from pg_proc where oid = 'public.sync_opening_due()'::regprocedure), 'sync_opening_due() is security definer with a fixed search_path');
select ok((select prosecdef and coalesce(proconfig::text, '') like '%search_path%' from pg_proc where oid = 'public.create_missing_opening_dues(timestamptz)'::regprocedure), 'create_missing_opening_dues(timestamptz) is security definer with a fixed search_path');

select * from finish();
rollback;