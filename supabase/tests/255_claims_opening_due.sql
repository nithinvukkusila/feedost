-- R1-10 Part A review fix, criterion 2 (docs/specs/R1-10-paid-claims-inbox.md, plan section 17). sync_opening_due() treats a
-- pending claim on the opening due as it treats a payment: the trigger neither changes the amount of that due nor deletes it, so a
-- pending claim is never removed by cascade. A pending claim freezes only the due it names: another student's claim, a claim on a
-- monthly fee, and a claim that was rejected do not. Another tutor's edit touches nothing of tutor A.
-- Updates are made as the tutor (the realistic path); fixtures and reads are made as the test runner. Self-contained; rolls back.
begin;
select tests.assert_ready();
select plan(31);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
insert into public.students (id, tutor_id, name, opening_balance) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'Earlier, claim pending', 50000),
  ('a1000000-0000-4000-8000-000000000002', tests.tutor_a(), 'Earlier, no claim', 40000),
  ('a1000000-0000-4000-8000-000000000003', tests.tutor_a(), 'Earlier, claim rejected', 30000),
  ('a1000000-0000-4000-8000-000000000004', tests.tutor_a(), 'Earlier, claim on a monthly fee', 20000),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'B earlier, no claim', 70000);
insert into public.dues (id, tutor_id, student_id, kind, month, amount, due_date) values
  ('a2000000-0000-4000-8000-000000000004', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000004', 'monthly', '2026-10-01', 100000, '2026-10-05');

-- The opening due of each student, as the insert trigger made it
create temp table opening_due on commit drop as
  select student_id, id from public.dues where kind = 'opening';

insert into public.payment_claims (id, tutor_id, student_id, due_id, amount, fee_count, upi_ref) values
  ('a6000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001',
   (select id from opening_due where student_id = 'a1000000-0000-4000-8000-000000000001'), 50000, 1, '111111111111'),
  ('a6000000-0000-4000-8000-000000000003', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003',
   (select id from opening_due where student_id = 'a1000000-0000-4000-8000-000000000003'), 30000, 1, '333333333333'),
  ('a6000000-0000-4000-8000-000000000004', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000004',
   'a2000000-0000-4000-8000-000000000004', 120000, 2, '444444444444');

select is((select count(*) from opening_due)::int, 5, 'every student starts with one opening due');

-- (a) A pending claim on the earlier balance: clearing "Already owes" keeps the due (same id, same amount) and the claim
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set opening_balance = 0 where id = 'a1000000-0000-4000-8000-000000000001'$$, '(a) A clears the earlier balance of a student with a pending claim on it');
select tests.reset();
select is((select id from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001' and kind = 'opening'),
  (select id from opening_due where student_id = 'a1000000-0000-4000-8000-000000000001'), '(a) the opening due is kept, with the same id');
select is((select amount || '/' || amount_paid from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001' and kind = 'opening'), '50000/0', '(a) and the same amount');
select is((select status from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000001'), 'pending', '(a) the claim is still pending');
select is((select due_id from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000001'),
  (select id from opening_due where student_id = 'a1000000-0000-4000-8000-000000000001'), '(a) and still names the same due');

-- (b) Changing the balance to another value leaves the due's amount unchanged
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set opening_balance = 80000 where id = 'a1000000-0000-4000-8000-000000000001'$$, '(b) A sets the balance to a new value while the claim is pending');
select lives_ok($$update public.students set opening_balance = 20000 where id = 'a1000000-0000-4000-8000-000000000001'$$, '(b) and to a lower one');
select tests.reset();
select is((select amount || '/' || amount_paid from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001' and kind = 'opening'), '50000/0', '(b) the due still says 50000');
select is((select count(*) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001' and kind = 'opening')::int, 1, '(b) and there is still exactly one opening due');
select is((select status from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000001'), 'pending', '(b) the claim is still pending');

-- (c) A pending claim on another student does not freeze this student's opening due
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set opening_balance = 60000 where id = 'a1000000-0000-4000-8000-000000000002'$$, '(c) A raises the balance of a student with no claim');
select tests.reset();
select is((select amount from public.dues where student_id = 'a1000000-0000-4000-8000-000000000002' and kind = 'opening'), 60000, '(c) the due follows the balance');
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set opening_balance = 0 where id = 'a1000000-0000-4000-8000-000000000002'$$, '(c) A clears it');
select tests.reset();
select is((select count(*) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000002' and kind = 'opening')::int, 0, '(c) and the due is gone, as before');
select is((select status from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000001'), 'pending', '(c) the other student claim is untouched');

-- (d) After reject_claim the due is free again: raising updates it, clearing deletes it and the rejected claim goes with it
select tests.act_as(tests.tutor_a());
select is((select status from public.reject_claim('a6000000-0000-4000-8000-000000000003')), 'rejected', '(d) A rejects the claim on the earlier balance');
select lives_ok($$update public.students set opening_balance = 45000 where id = 'a1000000-0000-4000-8000-000000000003'$$, '(d) A raises the balance');
select tests.reset();
select is((select amount from public.dues where student_id = 'a1000000-0000-4000-8000-000000000003' and kind = 'opening'), 45000, '(d) the due follows the balance');
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set opening_balance = 0 where id = 'a1000000-0000-4000-8000-000000000003'$$, '(d) A clears it');
select tests.reset();
select is((select count(*) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000003' and kind = 'opening')::int, 0, '(d) the due is deleted');
select is((select count(*) from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000003')::int, 0, '(d) and the rejected claim goes with it (criterion 2)');

-- (e) A pending claim whose due is a monthly fee does not stop an earlier-balance edit
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set opening_balance = 25000 where id = 'a1000000-0000-4000-8000-000000000004'$$, '(e) A raises the balance of a student whose pending claim names a monthly fee');
select tests.reset();
select is((select amount from public.dues where student_id = 'a1000000-0000-4000-8000-000000000004' and kind = 'opening'), 25000, '(e) the opening due follows the balance');
select tests.act_as(tests.tutor_a());
select lives_ok($$update public.students set opening_balance = 0 where id = 'a1000000-0000-4000-8000-000000000004'$$, '(e) A clears it');
select tests.reset();
select is((select count(*) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000004' and kind = 'opening')::int, 0, '(e) the opening due is gone');
select is((select status || '/' || amount from public.payment_claims c join public.dues d on d.id = c.due_id where c.id = 'a6000000-0000-4000-8000-000000000004'), 'pending/100000', '(e) the claim is still pending and its monthly fee is unchanged');

-- (f) Tutor B's edits touch nothing of tutor A
select tests.act_as(tests.tutor_b());
select lives_ok($$update public.students set opening_balance = 0 where id = 'b1000000-0000-4000-8000-000000000001'$$, '(f) B clears the earlier balance of her own student');
select lives_ok($$update public.students set opening_balance = 0 where id = 'a1000000-0000-4000-8000-000000000001'$$, '(f) B tries to clear A student (row-level security matches no row)');
select tests.reset();
select is((select count(*) from public.dues where student_id = 'b1000000-0000-4000-8000-000000000001' and kind = 'opening')::int, 0, '(f) B own opening due follows her edit and is gone');
select is((select d.id = o.id and d.amount = 50000 and c.status = 'pending' and s.opening_balance = 20000
             from public.dues d
             join opening_due o on o.student_id = d.student_id
             join public.payment_claims c on c.due_id = d.id
             join public.students s on s.id = d.student_id
            where d.student_id = 'a1000000-0000-4000-8000-000000000001' and d.kind = 'opening'),
  true, '(f) A due, claim and student are exactly as A left them');

select * from finish();
rollback;
