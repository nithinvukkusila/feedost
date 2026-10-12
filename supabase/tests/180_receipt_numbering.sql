-- R1-7 Part A criterion 5 (docs/specs/R1-7-record-payment.md, plan sections 2, 6 and risk 2). Receipt numbers are
-- 1, 2, 3 ... per tutor with no gap and no repeat; a refused call uses no number; two tutors both start at 1; a void
-- does not free a number. Two calls at the same moment cannot be shown by one transaction: that is
-- supabase/tests/concurrency/record_payment_concurrent.sh. Self-contained; rolls back.
begin;
select tests.assert_ready();
select plan(10);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
insert into public.students (id, tutor_id, name) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'A one'),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'B one');
-- Fifty monthly dues for A (a month each, 2020 onwards) and one for B.
insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date)
select tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', (date '2020-01-01' + (g || ' months')::interval)::date, 1000, 0, 'due', date '2020-01-05'
from generate_series(0, 49) g;
insert into public.dues (id, tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values
  ('b2000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 90000, 0, 'due', '2026-10-05');

-- 25 payments, then a refused call, then 25 more
select tests.act_as(tests.tutor_a());
select is((select count(r.receipt_no) from (select id from public.dues where tutor_id = tests.tutor_a() order by month limit 25) d, lateral public.record_payment(d.id, 1000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid()) r)::int, 25, 'A records 25 payments');
select throws_ok($$select public.record_payment((select id from public.dues where tutor_id = tests.tutor_a() order by month limit 1), 1000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'already_paid', 'a refused call in between');
select is((select count(r.receipt_no) from (select id from public.dues where tutor_id = tests.tutor_a() and status = 'due' order by month limit 25) d, lateral public.record_payment(d.id, 1000, 'upi', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid()) r)::int, 25, 'A records 25 more');
select tests.reset();

select is((select string_agg(receipt_no::text, ',' order by receipt_no) from public.payments where tutor_id = tests.tutor_a()), (select string_agg(g::text, ',' order by g) from generate_series(1, 50) g), 'the 50 payments are numbered 1 to 50 with no gap and no repeat');
select is((select last_no from public.receipt_counters where tutor_id = tests.tutor_a()), 50, 'the counter is at 50');

-- B starts at 1
select tests.act_as(tests.tutor_b());
select is((select receipt_no from public.record_payment('b2000000-0000-4000-8000-000000000001', 1000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())), 1, 'B first receipt is number 1');
select tests.reset();

-- A void frees nothing
select tests.act_as(tests.tutor_a());
select lives_ok($$select public.void_payment((select id from public.payments where receipt_no = 50 and tutor_id = tests.tutor_a()))$$, 'A voids receipt 50');
select is((select receipt_no from public.record_payment((select due_id from public.payments where receipt_no = 50 and tutor_id = tests.tutor_a()), 1000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())), 51, 'the next receipt is 51, not 50');
select tests.reset();
select is((select count(distinct receipt_no) from public.payments where tutor_id = tests.tutor_a())::int, 51, 'there are 51 distinct numbers');
select is((select max(receipt_no) - count(*) from public.payments where tutor_id = tests.tutor_a())::int, 0, 'and no gap (voided numbers stay as rows)');

select * from finish();
rollback;
