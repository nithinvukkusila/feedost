-- R1-7 Part A review fix (20261012135000_r1_opening_due_with_payments.sql). An opening due that has any payments
-- row, voided or not, is never deleted or changed by sync_opening_due(). Self-contained; rolls back.
-- payments_due_fkey is deferred, so each case sets constraints immediate to see a failure now, not at commit.
begin;
select tests.assert_ready();
select plan(12);

insert into auth.users (id, email) values (tests.tutor_a(), 'tutor-a@example.test');
set constraints all immediate;
insert into public.students (id, tutor_id, name, opening_balance) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'Part paid then undone', 50000),
  ('a1000000-0000-4000-8000-000000000002', tests.tutor_a(), 'Part paid and kept', 50000),
  ('a1000000-0000-4000-8000-000000000003', tests.tutor_a(), 'Never paid', 50000);

select tests.act_as(tests.tutor_a());
select lives_ok($$select public.record_payment((select id from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001' and kind = 'opening'), 10000, 'cash', (now() at time zone 'Asia/Kolkata')::date, 'a4000000-0000-4000-8000-000000000001')$$, 'part pay the first opening due');
select lives_ok($$select public.void_payment((select id from public.payments where request_id = 'a4000000-0000-4000-8000-000000000001'))$$, 'undo it');
select lives_ok($$select public.record_payment((select id from public.dues where student_id = 'a1000000-0000-4000-8000-000000000002' and kind = 'opening'), 10000, 'cash', (now() at time zone 'Asia/Kolkata')::date, 'a4000000-0000-4000-8000-000000000002')$$, 'part pay the second opening due and keep it');
select tests.reset();
select is((select amount_paid from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001' and kind = 'opening'), 0, 'after the undo the first due has amount_paid 0 and a voided payment');

-- Already owes to 0 after part-pay then undo: the due stays, the save does not fail
select lives_ok($$update public.students set opening_balance = 0 where id = 'a1000000-0000-4000-8000-000000000001'$$, 'Already owes to 0 after part-pay and undo does not fail');
select is((select amount from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001' and kind = 'opening'), 50000, 'and the due is kept as it was');

-- Already owes to a new value: the due is not changed
select lives_ok($$update public.students set opening_balance = 70000 where id = 'a1000000-0000-4000-8000-000000000001'$$, 'Already owes to a new value after part-pay and undo does not fail');
select is((select amount from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001' and kind = 'opening'), 50000, 'and the due still says 50000');

-- The locked case: a live payment freezes the due
select lives_ok($$update public.students set opening_balance = 0 where id = 'a1000000-0000-4000-8000-000000000002'$$, 'Already owes to 0 with a live payment does not fail');
select is((select amount || '/' || amount_paid from public.dues where student_id = 'a1000000-0000-4000-8000-000000000002' and kind = 'opening'), '50000/10000', 'and the due is unchanged');

-- Unchanged behaviour: with no payment the due follows and goes away
select lives_ok($$update public.students set opening_balance = 0 where id = 'a1000000-0000-4000-8000-000000000003'$$, 'a never-paid student set to 0 is saved');
select is((select count(*) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000003' and kind = 'opening')::int, 0, 'and its opening due is gone (the old behaviour is kept)');

select * from finish();
rollback;
