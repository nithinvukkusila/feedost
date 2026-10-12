-- R1-8 Part A (docs/specs/R1-8-reminders.md, plan task 2). public.reminders, record_reminder, last_reminders:
-- isolation between tutors and from anon, refusals that write nothing, idempotent retry, privileges, and that
-- no phone, name, text or amount is stored. Self-contained; rolls back. Error words are the contract at the top of
-- 20261012150000_r1_reminders.sql.
begin;
select tests.assert_ready();
select plan(51);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
insert into public.students (id, tutor_id, name, parent_phone, active) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'A one', '+919876543210', true),
  ('a1000000-0000-4000-8000-000000000002', tests.tutor_a(), 'A archived', '+919876543211', false),
  ('a1000000-0000-4000-8000-000000000003', tests.tutor_a(), 'A no phone', null, true),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'B one', '+919876543212', true);
insert into public.dues (id, tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values
  ('a2000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 120000, 0, 'due', '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-09-01', 100000, 100000, 'paid', '2026-09-05'),
  ('a2000000-0000-4000-8000-000000000003', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'monthly', '2026-10-01', 100000, 0, 'due', '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000004', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'monthly', '2026-10-01', 100000, 0, 'due', '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000005', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-08-01', 100000, 40000, 'partial', '2026-08-05'),
  ('b2000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 90000, 0, 'due', '2026-10-05');

-- Shape
select ok((select relrowsecurity from pg_class where oid = 'public.reminders'::regclass), 'row-level security is on for reminders');
select is((select string_agg(policyname::text, ',') from pg_policies where schemaname = 'public' and tablename = 'reminders'), 'reminders_select', 'reminders_select is the only policy');
select is((select roles::text from pg_policies where schemaname = 'public' and tablename = 'reminders'), '{authenticated}', 'the policy is for authenticated only');
select is((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'reminders' and column_name ~* '(phone|name|text|message|body|amount)')::int, 0, 'no phone, name, text or amount column exists');
select is((select string_agg(column_name::text, ',' order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'reminders'), 'channel,due_id,id,request_id,sent_at,template,tutor_id', 'the table holds exactly the planned columns');
select ok((select column_default is null and is_nullable = 'NO' from information_schema.columns where table_schema = 'public' and table_name = 'reminders' and column_name = 'tutor_id'), 'reminders.tutor_id is not null with no default');

-- Privileges
select ok(has_table_privilege('authenticated', 'public.reminders', 'select'), 'authenticated reads reminders');
select ok(not has_table_privilege('authenticated', 'public.reminders', 'insert,update,delete,truncate,references,trigger') and not has_any_column_privilege('authenticated', 'public.reminders', 'insert,update,references'), 'authenticated holds no write privilege on reminders');
select ok(not has_table_privilege('anon', 'public.reminders', 'select,insert,update,delete,truncate,references,trigger') and not has_any_column_privilege('anon', 'public.reminders', 'select,insert,update,references'), 'anon holds no privilege on reminders');
select ok(has_function_privilege('authenticated', 'public.record_reminder(uuid, text, uuid)', 'execute') and has_function_privilege('authenticated', 'public.last_reminders()', 'execute'), 'authenticated can execute both functions');
select ok(not has_function_privilege('anon', 'public.record_reminder(uuid, text, uuid)', 'execute') and not has_function_privilege('anon', 'public.last_reminders()', 'execute'), 'anon cannot execute either function');
select ok((select prosecdef and coalesce(proconfig::text, '') like '%search_path%' from pg_proc where oid = 'public.record_reminder(uuid, text, uuid)'::regprocedure), 'record_reminder is security definer with a fixed search_path');
select ok((select not prosecdef and provolatile = 's' and coalesce(proconfig::text, '') like '%search_path%' from pg_proc where oid = 'public.last_reminders()'::regprocedure), 'last_reminders is security invoker, stable, with a fixed search_path');

-- Anonymous
select tests.act_as_anon();
select throws_ok($$select count(*) from public.reminders$$, '42501', null, 'anon cannot select reminders');
select throws_ok($$select public.record_reminder('a2000000-0000-4000-8000-000000000001', 'polite:en:month', gen_random_uuid())$$, '42501', null, 'anon cannot call record_reminder');
select throws_ok($$select * from public.last_reminders()$$, '42501', null, 'anon cannot call last_reminders');
select tests.reset();

-- A token with no sub
select tests.act_as(tests.tutor_a());
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.record_reminder('a2000000-0000-4000-8000-000000000001', 'polite:en:month', gen_random_uuid())$$, '42501', 'not_signed_in', 'a token with no sub is refused');
select tests.reset();

-- Success
select tests.act_as(tests.tutor_a());
select ok((select public.record_reminder('a2000000-0000-4000-8000-000000000001', 'polite:en:month', 'a4000000-0000-4000-8000-000000000001')) is not null, 'A logs a reminder and gets a time back');
select tests.reset();
select is((select count(*) from public.reminders where tutor_id = tests.tutor_a())::int, 1, 'one row written');
select is((select template || '/' || channel || '/' || due_id::text from public.reminders where request_id = 'a4000000-0000-4000-8000-000000000001'), 'polite:en:month/click_to_chat/a2000000-0000-4000-8000-000000000001', 'the row holds the tag, the channel and the fee');

-- Idempotent replay: same time, one row
select tests.act_as(tests.tutor_a());
select is((select public.record_reminder('a2000000-0000-4000-8000-000000000001', 'polite:en:month', 'a4000000-0000-4000-8000-000000000001')), (select sent_at from public.reminders where request_id = 'a4000000-0000-4000-8000-000000000001'), 'the same request id returns the same time');
select tests.reset();
select is((select count(*) from public.reminders where tutor_id = tests.tutor_a())::int, 1, 'a replay writes no second row');

-- A second reminder, new request id, same fee, same day: allowed
select tests.act_as(tests.tutor_a());
select lives_ok($$select public.record_reminder('a2000000-0000-4000-8000-000000000001', 'firm:hi:balance', 'a4000000-0000-4000-8000-000000000002')$$, 'a second reminder the same day is allowed');
select tests.reset();
select is((select count(*) from public.reminders where due_id = 'a2000000-0000-4000-8000-000000000001')::int, 2, 'two rows for that fee');

-- Refusals (each leaves the count unchanged; checked together at the end)
select tests.act_as(tests.tutor_a());
select throws_ok($$select public.record_reminder('a2000000-0000-4000-8000-000000000002', 'polite:en:month', gen_random_uuid())$$, 'P0001', 'already_paid', 'a paid fee is refused');
select throws_ok($$select public.record_reminder('a2000000-0000-4000-8000-000000000003', 'polite:en:month', gen_random_uuid())$$, 'P0001', 'student_archived', 'an archived student is refused');
select throws_ok($$select public.record_reminder('a2000000-0000-4000-8000-000000000004', 'polite:en:month', gen_random_uuid())$$, 'P0001', 'no_phone', 'a student with no phone is refused');
select throws_ok($$select public.record_reminder(gen_random_uuid(), 'polite:en:month', gen_random_uuid())$$, 'P0001', 'due_not_found', 'an unknown fee is refused');
select throws_ok($$select public.record_reminder('b2000000-0000-4000-8000-000000000001', 'polite:en:month', gen_random_uuid())$$, 'P0001', 'due_not_found', 'another tutor fee gives the same word as an unknown one');
select throws_ok($$select public.record_reminder(null, 'polite:en:month', gen_random_uuid())$$, 'P0001', 'invalid_argument', 'a null fee is refused');
select throws_ok($$select public.record_reminder('a2000000-0000-4000-8000-000000000001', null, gen_random_uuid())$$, 'P0001', 'invalid_argument', 'a null template is refused');
select throws_ok($$select public.record_reminder('a2000000-0000-4000-8000-000000000001', 'polite:en:month', null)$$, 'P0001', 'invalid_argument', 'a null request id is refused');
select throws_ok($$select public.record_reminder('a2000000-0000-4000-8000-000000000001', 'rude:en:month', gen_random_uuid())$$, 'P0001', 'invalid_argument', 'a bad tone is refused');
select throws_ok($$select public.record_reminder('a2000000-0000-4000-8000-000000000001', 'polite:fr:month', gen_random_uuid())$$, 'P0001', 'invalid_argument', 'a bad language is refused');
select throws_ok($$select public.record_reminder('a2000000-0000-4000-8000-000000000001', 'polite:en:month ', gen_random_uuid())$$, 'P0001', 'invalid_argument', 'a template with trailing text is refused');
select tests.reset();
select is((select count(*) from public.reminders where tutor_id = tests.tutor_a())::int, 2, 'no refusal wrote anything');
select is((select count(*) from public.reminders where tutor_id = tests.tutor_b())::int, 0, 'nothing was written for B by A calling with B fee');

-- Replay after the fee is paid still answers the same
update public.dues set amount_paid = amount, status = 'paid' where id = 'a2000000-0000-4000-8000-000000000001';
select tests.act_as(tests.tutor_a());
select is((select public.record_reminder('a2000000-0000-4000-8000-000000000001', 'polite:en:month', 'a4000000-0000-4000-8000-000000000001')), (select sent_at from public.reminders where request_id = 'a4000000-0000-4000-8000-000000000001'), 'a retry after the fee was paid answers the same');
select throws_ok($$select public.record_reminder('a2000000-0000-4000-8000-000000000001', 'polite:en:month', gen_random_uuid())$$, 'P0001', 'already_paid', 'but a new request for the now-paid fee is refused');
select tests.reset();
update public.dues set amount_paid = 0, status = 'due' where id = 'a2000000-0000-4000-8000-000000000001';

-- The channel and template checks hold even for the owner
select throws_ok($$insert into public.reminders (tutor_id, due_id, channel, template, request_id) values (tests.tutor_a(), 'a2000000-0000-4000-8000-000000000001', 'sms', 'polite:en:month', gen_random_uuid())$$, '23514', null, 'channel other than click_to_chat is refused');
select throws_ok($$insert into public.reminders (tutor_id, due_id, template, request_id) values (tests.tutor_a(), 'a2000000-0000-4000-8000-000000000001', 'hello', gen_random_uuid())$$, '23514', null, 'a free-text template is refused');

-- last_reminders: A has two on fee 1 and one on fee 5 (partial); fee 3 is archived, fee 2 is paid
select tests.act_as(tests.tutor_a());
select lives_ok($$select public.record_reminder('a2000000-0000-4000-8000-000000000005', 'firm:en:balance', 'a4000000-0000-4000-8000-000000000003')$$, 'A reminds a part-paid fee');
select tests.reset();
insert into public.reminders (tutor_id, due_id, template, request_id, sent_at) values
  (tests.tutor_a(), 'a2000000-0000-4000-8000-000000000002', 'polite:en:month', gen_random_uuid(), now() - interval '40 days'),
  (tests.tutor_a(), 'a2000000-0000-4000-8000-000000000003', 'polite:en:month', gen_random_uuid(), now() - interval '2 days');
select tests.act_as(tests.tutor_a());
select is((select count(*) from public.last_reminders())::int, 2, 'A sees only unpaid fees of active students');
select is((select times from public.last_reminders() where due_id = 'a2000000-0000-4000-8000-000000000001'), 2, 'times counts both reminders on fee 1');
select is((select last_sent_at from public.last_reminders() where due_id = 'a2000000-0000-4000-8000-000000000001'), (select max(sent_at) from public.reminders where due_id = 'a2000000-0000-4000-8000-000000000001'), 'last_sent_at is the latest');
select is((select count(*) from public.reminders)::int, 5, 'A reads her own rows');
select tests.reset();

-- B sees nothing of A
select tests.act_as(tests.tutor_b());
select is((select count(*) from public.reminders)::int, 0, 'B reads none of A reminders');
select is((select count(*) from public.last_reminders())::int, 0, 'B last_reminders is empty');
select throws_ok($$insert into public.reminders (tutor_id, due_id, template, request_id) values (tests.tutor_b(), 'b2000000-0000-4000-8000-000000000001', 'polite:en:month', gen_random_uuid())$$, '42501', null, 'B cannot insert directly');
select throws_ok($$delete from public.reminders$$, '42501', null, 'B cannot delete');
select tests.reset();

-- Deleting a tutor removes their reminders and leaves the other tutor's
delete from public.tutors where id = tests.tutor_a();
select is((select count(*) from public.reminders where tutor_id = tests.tutor_a())::int, 0, 'deleting a tutor removes their reminders');

select * from finish();
rollback;
