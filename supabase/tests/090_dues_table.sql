-- R1-5 criteria 1 to 7 (docs/specs/R1-5-dues.md section 4 and plan section 5). public.dues: the columns, the money
-- and status checks, the month rule, the two unique keys, the same-tutor foreign key (deferred), the cascade on
-- account delete, and updated_at. Self-contained: makes its own users (the trigger makes the tutors rows) and
-- rolls everything back. Fixtures are inserted as the test runner, so only a constraint can refuse a row.
-- A deferred key is forced with "set constraints all immediate" inside a do block (so throws_ok sees the 23503).
begin;
select tests.assert_ready();
select plan(41);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
insert into public.students (id, tutor_id, name) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'A one'),
  ('a1000000-0000-4000-8000-000000000002', tests.tutor_a(), 'A two'),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'B one');

-- Shape
select ok(to_regclass('public.dues') is not null, 'public.dues exists');
select columns_are('public', 'dues',
  array['id','tutor_id','student_id','kind','month','amount','amount_paid','status','due_date','created_at','updated_at']::name[],
  'dues has exactly the eleven planned columns');
select is_empty(
  $$select a.attname from pg_attribute a
    where a.attrelid = 'public.dues'::regclass and a.attnum > 0 and not a.attisdropped
      and (a.attname::text, format_type(a.atttypid, a.atttypmod)) not in (values
        ('id','uuid'), ('tutor_id','uuid'), ('student_id','uuid'), ('kind','text'), ('month','date'),
        ('amount','integer'), ('amount_paid','integer'), ('status','text'), ('due_date','date'),
        ('created_at','timestamp with time zone'), ('updated_at','timestamp with time zone'))$$,
  'every column has the planned type (money is integer, days are date)');
select is_empty(
  $$select a.attname from pg_attribute a
    where a.attrelid = 'public.dues'::regclass and a.attnum > 0 and not a.attisdropped
      and a.attname <> 'month' and not a.attnotnull$$,
  'every column except month is not null');
select is_empty(
  $$select c from unnest(array['id','kind','amount_paid','status','created_at','updated_at']) as c
    where not exists (select 1 from pg_attribute a where a.attrelid = 'public.dues'::regclass and a.attname = c and a.atthasdef)$$,
  'id, kind, amount_paid, status, created_at and updated_at have defaults');
select ok(not (select a.atthasdef from pg_attribute a where a.attrelid = 'public.dues'::regclass and a.attname = 'tutor_id'),
  'tutor_id has no default (no client ever inserts a due)');
select ok(exists (select 1 from pg_constraint c
    where c.conrelid = 'public.dues'::regclass and c.contype = 'p'
      and c.conkey = array[(select a.attnum from pg_attribute a where a.attrelid = 'public.dues'::regclass and a.attname = 'id')]),
  'id is the primary key');
select is_empty(
  $$select n from unnest(array['dues_kind_check','dues_status_check','dues_amount_check','dues_amount_paid_check','dues_status_agrees_check','dues_month_check']) as n
    where not exists (select 1 from pg_constraint c where c.conrelid = 'public.dues'::regclass and c.contype = 'c' and c.conname = n)$$,
  'all six named checks exist');

-- Accepted rows. They also prove that one student can hold an opening due and monthly dues, and that two
-- students can hold dues for the same month.
select lives_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 120000, 0, 'due', '2026-10-05')$$, 'a monthly due is accepted');
select lives_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'opening', null, 50000, 0, 'due', '2026-10-12')$$, 'an opening due is accepted (same student, no month)');
select lives_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'monthly', '2026-10-01', 1000, 400, 'partial', '2026-10-05')$$, 'a part paid due is accepted');
select lives_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'monthly', '2026-09-01', 1000, 1000, 'paid', '2026-09-05')$$, 'a paid due is accepted');
select lives_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 100000000, 0, 'due', '2026-10-05')$$, 'an amount of 100000000 is accepted');

-- Refused by a check (all 23514; the list of names above proves each check exists)
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-08-01', 0, 0, 'due', '2026-08-05')$$, '23514', null, 'amount 0 is refused');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-08-01', -1, 0, 'due', '2026-08-05')$$, '23514', null, 'amount -1 is refused');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-08-01', 100000001, 0, 'due', '2026-08-05')$$, '23514', null, 'amount over the ceiling is refused');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-08-01', 1000, 1001, 'paid', '2026-08-05')$$, '23514', null, 'amount_paid above amount is refused');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-08-01', 1000, -1, 'due', '2026-08-05')$$, '23514', null, 'negative amount_paid is refused');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-08-01', 1000, 0, 'paid', '2026-08-05')$$, '23514', null, 'status paid with amount_paid 0 is refused');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-08-01', 1000, 10, 'due', '2026-08-05')$$, '23514', null, 'status due with amount_paid above 0 is refused');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-08-01', 1000, 0, 'partial', '2026-08-05')$$, '23514', null, 'status partial with amount_paid 0 is refused');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-08-01', 1000, 1000, 'partial', '2026-08-05')$$, '23514', null, 'status partial with amount_paid equal to amount is refused');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-08-01', 1000, 0, 'overdue', '2026-08-05')$$, '23514', null, 'status overdue is refused');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'other', '2026-08-01', 1000, 0, 'due', '2026-08-05')$$, '23514', null, 'kind other is refused');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', null, 1000, 0, 'due', '2026-08-05')$$, '23514', null, 'monthly with a null month is refused');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'opening', '2026-08-01', 1000, 0, 'due', '2026-08-05')$$, '23514', null, 'opening with a month is refused');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-15', 1000, 0, 'due', '2026-08-05')$$, '23514', null, 'a month that is not a first day is refused');

-- A decimal as text cannot be read as an integer. (A typed numeric is rounded by PostgreSQL's assignment cast; nobody can send one: clients cannot insert.)
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-08-01', '12.5', 0, 'due', '2026-08-05')$$, '22P02', null, 'an amount of 12.5 as text is refused');

-- The two unique keys
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 1000, 0, 'due', '2026-10-05')$$, '23505', null, 'a second monthly due for the same student and month is refused');
select throws_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'opening', null, 1000, 0, 'due', '2026-10-12')$$, '23505', null, 'a second opening due for one student is refused');
select lives_ok($$insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-09-01', 1000, 0, 'due', '2026-09-05')$$, 'one student can have monthly dues for two different months, beside the opening due');

-- The same-tutor key is deferred: force the check inside a do block
select throws_ok($t$do $b$ begin insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_a(), 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'monthly', '2026-07-01', 1000, 0, 'due', '2026-07-05'); set constraints all immediate; end $b$ $t$, '23503', null, 'a due for a student that does not exist is refused');
select throws_ok($t$do $b$ begin insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values (tests.tutor_b(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-07-01', 1000, 0, 'due', '2026-07-05'); set constraints all immediate; end $b$ $t$, '23503', null, 'tutor B cannot hold a due for tutor A student');
select throws_ok($t$do $b$ begin delete from public.students where id = 'a1000000-0000-4000-8000-000000000001'; set constraints all immediate; end $b$ $t$, '23503', null, 'deleting a student that has dues is refused');

-- updated_at moves forward on update (set_updated_at uses clock_timestamp, so it moves inside one transaction)
create temp table due_before as
  select id, updated_at from public.dues where student_id = 'a1000000-0000-4000-8000-000000000002' and month = '2026-10-01';
update public.dues set amount = 2000 where student_id = 'a1000000-0000-4000-8000-000000000002' and month = '2026-10-01';
select ok((select d.updated_at > b.updated_at from public.dues d join due_before b on b.id = d.id), 'updated_at moves forward on update');

-- Removing a tutor's auth user removes their tutors row, students and dues without error, and only theirs
select lives_ok($t$do $b$ begin delete from auth.users where id = tests.tutor_a(); set constraints all immediate; end $b$ $t$,
  'deleting a tutor removes their students and dues in one statement');
select is((select count(*) from public.tutors where id = tests.tutor_a())::int, 0, 'A tutor row is gone');
select is((select count(*) from public.students where tutor_id = tests.tutor_a())::int, 0, 'A students are gone');
select is((select count(*) from public.dues where tutor_id = tests.tutor_a())::int, 0, 'A dues are gone');
select is((select count(*) from public.students where tutor_id = tests.tutor_b())::int, 1, 'B student stays');
select is((select count(*) from public.dues where tutor_id = tests.tutor_b())::int, 1, 'B due stays');

select * from finish();
rollback;
