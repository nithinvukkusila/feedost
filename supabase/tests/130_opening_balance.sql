-- R1-5 criteria 34 to 39 (docs/specs/R1-5-dues.md section 4 and plan section 5). The opening balance: a student saved
-- with "Already owes" gets one opening due in the same transaction; changing it follows the balance while nothing
-- is paid and is frozen after; archiving leaves it; the largest balance and zero both save; the backfill creates
-- what is missing once. Inserts and updates are made as tutor A (the realistic path); the dues are read as the
-- test runner, because india_day is not callable by a tutor. Self-contained; rolls back.
begin;
select tests.assert_ready();
select plan(46);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');

-- Insert (criteria 34 and 39): Rs 1,200.00 is 120000 paise, with no rounding

select tests.act_as(tests.tutor_a());
select lives_ok($$insert into public.students (id, name, opening_balance) values ('a1000000-0000-4000-8000-000000000001', 'one', 120000)$$, 'A saves a student who already owes 120000');
select lives_ok($$insert into public.students (id, name, opening_balance) values ('a1000000-0000-4000-8000-000000000002', 'two', 0)$$, 'A saves a student with a balance of 0');
select lives_ok($$insert into public.students (id, name) values ('a1000000-0000-4000-8000-000000000003', 'three')$$, 'A saves a student with no balance given');
select tests.reset();
select ok((select count(*) = 1 and bool_and(kind = 'opening' and month is null and amount = 120000 and amount_paid = 0 and status = 'due'
    and due_date = public.india_day(now()) and tutor_id = tests.tutor_a()) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001'),
  'one opening due: kind opening, no month, 120000, nothing paid, due, dated the India day it was saved, A tutor');
select is((select count(*) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000002')::int, 0, 'a balance of 0 makes no due');
select is((select count(*) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000003')::int, 0, 'no balance given makes no due');
select tests.act_as(tests.tutor_a());
select is((select count(*) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001')::int, 1, 'A reads own opening due');
select tests.reset();
select tests.act_as(tests.tutor_b());
select is((select count(*) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001')::int, 0, 'B reads none of it');
select tests.reset();

-- Changing the balance while nothing is paid (criterion 35)
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set opening_balance = 150000 where id = 'a1000000-0000-4000-8000-000000000001'$$, 'A raises the balance');
select tests.reset();
select is((select string_agg(amount::text, ',') from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001'), '150000', 'the due follows: one row of 150000');
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set opening_balance = 0 where id = 'a1000000-0000-4000-8000-000000000001'$$, 'A sets the balance to 0');
select tests.reset();
select is((select count(*) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001')::int, 0, 'the due is removed');
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set opening_balance = 80000 where id = 'a1000000-0000-4000-8000-000000000001'$$, 'A sets it from 0 to 80000');
select tests.reset();
select is((select string_agg(amount::text, ',') from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001'), '80000', 'the due is created again with 80000');
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set name = 'one renamed' where id = 'a1000000-0000-4000-8000-000000000001'$$, 'A changes the name only');
select lives_ok($$update public.students set opening_balance = 80000 where id = 'a1000000-0000-4000-8000-000000000001'$$, 'A saves the same balance');
select tests.reset();
select is((select string_agg(amount::text, ',') from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001'), '80000', 'the due is unchanged');

-- Frozen once something is paid, and when fully paid (criterion 35)
update public.dues set amount_paid = 40000, status = 'partial' where student_id = 'a1000000-0000-4000-8000-000000000001';
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set opening_balance = 90000 where id = 'a1000000-0000-4000-8000-000000000001'$$, 'A changes the balance of a part paid due');
select lives_ok($$update public.students set opening_balance = 0 where id = 'a1000000-0000-4000-8000-000000000001'$$, 'A sets it to 0');
select lives_ok($$update public.students set opening_balance = 500000 where id = 'a1000000-0000-4000-8000-000000000001'$$, 'A sets it to 500000');
select tests.reset();
select ok((select count(*) = 1 and bool_and(amount = 80000 and amount_paid = 40000 and status = 'partial') from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001'), 'the part paid due is left as it is: one row, 80000, 40000 paid');
select tests.act_as(tests.tutor_a());
select lives_ok($$insert into public.students (id, name, opening_balance) values ('a1000000-0000-4000-8000-000000000004', 'four', 70000)$$, 'A saves a student who owes 70000');
select tests.reset();
update public.dues set amount_paid = 70000, status = 'paid' where student_id = 'a1000000-0000-4000-8000-000000000004';
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set opening_balance = 10 where id = 'a1000000-0000-4000-8000-000000000004'$$, 'A changes the balance of a fully paid due');
select tests.reset();
select ok((select count(*) = 1 and bool_and(amount = 70000 and amount_paid = 70000 and status = 'paid') from public.dues where student_id = 'a1000000-0000-4000-8000-000000000004'), 'the paid due is left as it is');

-- Archiving leaves it (criterion 37)
select tests.act_as(tests.tutor_a());
select lives_ok($$insert into public.students (id, name, opening_balance) values ('a1000000-0000-4000-8000-000000000005', 'five', 30000)$$, 'A saves a student who owes 30000');
select lives_ok($$update public.students set active = false where id = 'a1000000-0000-4000-8000-000000000005'$$, 'A archives them');
select tests.reset();
select ok((select count(*) = 1 and bool_and(amount = 30000) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000005'), 'the opening due of an archived student is kept');
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set active = true where id = 'a1000000-0000-4000-8000-000000000005'$$, 'A restores them');
select tests.reset();
select ok((select count(*) = 1 and bool_and(amount = 30000) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000005'), 'and it is still there, unchanged');

-- Limits: a failing trigger must never stop a student being saved (criterion 38)
select tests.act_as(tests.tutor_a());
select lives_ok($$insert into public.students (id, name, opening_balance) values ('a1000000-0000-4000-8000-000000000006', 'six', 100000000)$$, 'A saves the largest balance, 100000000');
select tests.reset();
select is((select string_agg(amount::text, ',') from public.dues where student_id = 'a1000000-0000-4000-8000-000000000006'), '100000000', 'its due is 100000000');
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set opening_balance = 100000000 where id = 'a1000000-0000-4000-8000-000000000006'$$, 'A saves the same largest balance again');
select lives_ok($$update public.students set opening_balance = 0 where id = 'a1000000-0000-4000-8000-000000000006'$$, 'A sets the largest balance to 0');
select tests.reset();
select is((select count(*) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000006')::int, 0, 'the due is gone');
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set opening_balance = 100000000 where id = 'a1000000-0000-4000-8000-000000000006'$$, 'A sets it to the largest balance again');
select tests.reset();
select is((select string_agg(amount::text, ',') from public.dues where student_id = 'a1000000-0000-4000-8000-000000000006'), '100000000', 'the due is back');
select tests.act_as(tests.tutor_a());
select throws_ok($$insert into public.students (id, name, opening_balance) values ('a1000000-0000-4000-8000-000000000007', 'seven', 100000001)$$, '23514', null, 'a balance over the ceiling is refused by the student own check');
select tests.reset();
select ok(not exists (select 1 from public.students where id = 'a1000000-0000-4000-8000-000000000007') and not exists (select 1 from public.dues where student_id = 'a1000000-0000-4000-8000-000000000007'), 'and no student and no due is left');

-- Backfill (criterion 36). Triggers off (this rolls back with the test), so these students have no due.
insert into public.students (id, tutor_id, name, opening_balance) values ('a1000000-0000-4000-8000-0000000000f0', tests.tutor_a(), 'bfx', 40000);
alter table public.students disable trigger user;
insert into public.students (tutor_id, name, opening_balance, active) values
  (tests.tutor_a(), 'bf1', 10000, true),
  (tests.tutor_a(), 'bf2', 20000, false),
  (tests.tutor_a(), 'bf3', 30000, true),
  (tests.tutor_a(), 'bf0', 0, true);
alter table public.students enable trigger user;
select is(public.create_missing_opening_dues('2026-10-12 05:00+00'), 3, 'the backfill creates three dues (archived students included, the one that has a due is skipped)');
select is((select count(*) from public.dues d join public.students s on s.id = d.student_id
  where s.name in ('bf1', 'bf2', 'bf3') and d.kind = 'opening' and d.due_date = '2026-10-12')::int, 3, 'they are opening dues dated the India day of the migration');
select is((select count(*) from public.dues d join public.students s on s.id = d.student_id where s.name = 'bfx')::int, 1, 'the student who already had a due has exactly one');
select is((select count(*) from public.dues d join public.students s on s.id = d.student_id where s.name = 'bf0')::int, 0, 'a student with no balance has none');
select is(public.create_missing_opening_dues('2026-10-12 05:00+00'), 0, 'run again, the backfill creates nothing');

-- The triggers
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.students'::regclass and tgname = 'students_sync_opening_due_insert' and not tgisinternal), 'students has the trigger students_sync_opening_due_insert');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.students'::regclass and tgname = 'students_sync_opening_due_update' and not tgisinternal), 'students has the trigger students_sync_opening_due_update');
select ok((select prosecdef and coalesce(proconfig::text, '') like '%search_path%' from pg_proc where oid = 'public.sync_opening_due()'::regprocedure), 'sync_opening_due is security definer with a fixed search_path');

select * from finish();
rollback;
