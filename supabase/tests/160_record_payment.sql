-- R1-7 Part A criteria 3, 4, 6, 7, 10, 11 (docs/specs/R1-7-record-payment.md, plan sections 2 and 6). record_payment:
-- the success path, every refusal (each with nothing changed and the counter unmoved), the retry rule, exact paise,
-- and who may run it. Self-contained; rolls back. The error words are the contract at the top of
-- 20261012130000_r1_payments.sql. Times are relative to now(), which does not move inside this transaction.
begin;
select tests.assert_ready();
select plan(65);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
insert into public.students (id, tutor_id, name, active) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'A one', true),
  ('a1000000-0000-4000-8000-000000000002', tests.tutor_a(), 'A archived', false),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'B one', true);
-- 120000 (1,200 rupees) fee; a paid due; a due of an archived student; 10,00,000 rupees; B's due.
insert into public.dues (id, tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values
  ('a2000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 120000, 0, 'due', '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-09-01', 100000, 100000, 'paid', '2026-09-05'),
  ('a2000000-0000-4000-8000-000000000003', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'monthly', '2026-10-01', 100000, 0, 'due', '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000004', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-08-01', 100000000, 0, 'due', '2026-08-05'),
  ('b2000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 90000, 0, 'due', '2026-10-05');

-- The function and who may run it (criterion 10)
select is(pg_get_function_result('public.record_payment(uuid, integer, text, date, uuid)'::regprocedure), 'payments', 'record_payment returns a payments row');
select ok((select prosecdef and coalesce(proconfig::text, '') like '%search_path%' from pg_proc where oid = 'public.record_payment(uuid, integer, text, date, uuid)'::regprocedure), 'record_payment is security definer with a fixed search_path');
select ok(has_function_privilege('authenticated', 'public.record_payment(uuid, integer, text, date, uuid)', 'execute'), 'authenticated can execute record_payment');
select ok(not has_function_privilege('anon', 'public.record_payment(uuid, integer, text, date, uuid)', 'execute'), 'anon cannot execute record_payment');
select ok(not has_function_privilege('anon', 'public.payments_immutable()', 'execute') and not has_function_privilege('authenticated', 'public.payments_immutable()', 'execute'), 'neither anon nor authenticated can execute payments_immutable');

-- Not signed in
select tests.act_as_anon();
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 1000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, '42501', null, 'no session cannot record a payment');
select tests.reset();
select tests.act_as(tests.tutor_a());
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 1000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, '42501', 'not_signed_in', 'a token with no sub is refused');
select tests.reset();

-- Success, part payment
select tests.act_as(tests.tutor_a());
select is((select receipt_no from public.record_payment('a2000000-0000-4000-8000-000000000001', 50000, 'upi', (now() at time zone 'Asia/Kolkata')::date, 'a4000000-0000-4000-8000-000000000001')), 1, 'the first payment is receipt number 1');
select tests.reset();
select is((select amount_paid || '/' || status from public.dues where id = 'a2000000-0000-4000-8000-000000000001'), '50000/partial', 'the due is partial with amount_paid 50000');
select is((select amount || '/' || method || '/' || balance_after || '/' || tutor_id::text || '/' || (voided_at is null)::text from public.payments where request_id = 'a4000000-0000-4000-8000-000000000001'), '50000/upi/70000/' || tests.tutor_a()::text || '/true', 'the payment row has the amount, method, balance_after 70000 and the caller as tutor');
select ok((select receipt_token ~ '^[A-Za-z0-9_-]{22,}$' and created_at is not null from public.payments where request_id = 'a4000000-0000-4000-8000-000000000001'), 'the payment has a token and a time');
select is((select last_no from public.receipt_counters where tutor_id = tests.tutor_a()), 1, 'the counter is at 1');

-- Retry with the same request id: the same row, one payment
select tests.act_as(tests.tutor_a());
select is((select receipt_no from public.record_payment('a2000000-0000-4000-8000-000000000001', 50000, 'upi', (now() at time zone 'Asia/Kolkata')::date, 'a4000000-0000-4000-8000-000000000001')), 1, 'the same request id returns receipt number 1 again');
select is((select receipt_token from public.record_payment('a2000000-0000-4000-8000-000000000001', 50000, 'upi', (now() at time zone 'Asia/Kolkata')::date, 'a4000000-0000-4000-8000-000000000001')), (select receipt_token from public.payments where request_id = 'a4000000-0000-4000-8000-000000000001'), 'and the same token');
select tests.reset();
select is((select count(*) from public.payments where tutor_id = tests.tutor_a())::int, 1, 'one payment after three calls with one request id');
select is((select amount_paid from public.dues where id = 'a2000000-0000-4000-8000-000000000001'), 50000, 'the due was charged once');
select is((select last_no from public.receipt_counters where tutor_id = tests.tutor_a()), 1, 'the counter did not move on a retry');
select tests.act_as(tests.tutor_a());
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 40000, 'upi', (now() at time zone 'Asia/Kolkata')::date, 'a4000000-0000-4000-8000-000000000001')$$, 'P0001', 'request_reused', 'the same request id with another amount is refused');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000004', 50000, 'upi', (now() at time zone 'Asia/Kolkata')::date, 'a4000000-0000-4000-8000-000000000001')$$, 'P0001', 'request_reused', 'the same request id with another due is refused');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 50000, 'cash', (now() at time zone 'Asia/Kolkata')::date, 'a4000000-0000-4000-8000-000000000001')$$, 'P0001', 'request_reused', 'the same request id with another method is refused');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 50000, 'upi', (now() at time zone 'Asia/Kolkata')::date - 1, 'a4000000-0000-4000-8000-000000000001')$$, 'P0001', 'request_reused', 'the same request id with another date is refused');
select tests.reset();

-- Refusals: each changes nothing and uses no number. The counter is at 1 and the due at 50000 throughout.
select tests.act_as(tests.tutor_a());
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 0, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'invalid_argument', 'amount 0 is refused');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', -5, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'invalid_argument', 'a negative amount is refused');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', null, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'invalid_argument', 'a null amount is refused');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 1000, 'bank', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'invalid_argument', 'method bank is refused');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 1000, 'gateway', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'invalid_argument', 'method gateway is refused');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 1000, 'UPI', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'invalid_argument', 'the method is case-exact');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 1000, 'cash', null, gen_random_uuid())$$, 'P0001', 'invalid_argument', 'a null date is refused');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 1000, 'cash', (now() at time zone 'Asia/Kolkata')::date, null)$$, 'P0001', 'invalid_argument', 'a null request id is refused');
select throws_ok($$select public.record_payment(null, 1000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'invalid_argument', 'a null due is refused');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 70001, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'amount_over_remaining', 'one paisa over what is left is refused');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 1000, 'cash', (now() at time zone 'Asia/Kolkata')::date + 1, gen_random_uuid())$$, 'P0001', 'date_out_of_range', 'tomorrow is refused');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 1000, 'cash', (now() at time zone 'Asia/Kolkata')::date - 91, gen_random_uuid())$$, 'P0001', 'date_out_of_range', '91 days back is refused');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000003', 1000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'student_archived', 'a due of an archived student is refused');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000002', 1000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'already_paid', 'a paid due is refused');
select throws_ok($$select public.record_payment('b2000000-0000-4000-8000-000000000001', 1000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'due_not_found', 'another tutor due is refused');
select throws_ok($$select public.record_payment('99999999-9999-4999-8999-999999999999', 1000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'due_not_found', 'an unknown due gives the same word');
select tests.reset();
select is((select last_no from public.receipt_counters where tutor_id = tests.tutor_a()), 1, 'after all the refusals the counter is still 1');
select is((select count(*) from public.payments where tutor_id = tests.tutor_a())::int, 1, 'and there is still one payment');
select is((select amount_paid || '/' || status from public.dues where id = 'a2000000-0000-4000-8000-000000000001'), '50000/partial', 'and the due is unchanged');
select is((select count(*) from public.payments where tutor_id = tests.tutor_b())::int + (select count(*) from public.receipt_counters where tutor_id = tests.tutor_b())::int, 0, 'B has no payment and no counter row from A attempts');
select is((select amount_paid from public.dues where id = 'b2000000-0000-4000-8000-000000000001'), 0, 'B due is untouched');

-- The detail of amount_over_remaining is the paise left
do $$
declare v_detail text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
  begin
    perform public.record_payment('a2000000-0000-4000-8000-000000000001', 70001, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid());
  exception when others then
    get stacked diagnostics v_detail = pg_exception_detail;
  end;
  perform set_config('tests.detail', coalesce(v_detail, 'none'), true);
  perform set_config('request.jwt.claims', '', true);
end $$;
select is(current_setting('tests.detail'), '70000', 'amount_over_remaining carries the paise left (70000) as its detail');

-- Edges that are allowed: today, 90 days back, the exact remaining, 1 paisa
select tests.act_as(tests.tutor_a());
select is((select receipt_no from public.record_payment('a2000000-0000-4000-8000-000000000001', 1, 'cash', (now() at time zone 'Asia/Kolkata')::date - 90, gen_random_uuid())), 2, 'one paisa dated 90 days back is accepted (number 2)');
select is((select balance_after from public.payments where receipt_no = 2 and tutor_id = tests.tutor_a()), 69999, 'its balance_after is 69999');
select is((select receipt_no from public.record_payment('a2000000-0000-4000-8000-000000000001', 69999, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())), 3, 'the exact remaining is accepted (number 3)');
select tests.reset();
select is((select amount_paid || '/' || status from public.dues where id = 'a2000000-0000-4000-8000-000000000001'), '120000/paid', 'the due is paid with amount_paid equal to amount');
select is((select balance_after from public.payments where receipt_no = 3 and tutor_id = tests.tutor_a()), 0, 'the last payment leaves a balance of 0');
select tests.act_as(tests.tutor_a());
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 1, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'already_paid', 'a new request on the now paid due is refused');
select is((select receipt_no from public.record_payment('a2000000-0000-4000-8000-000000000001', 50000, 'upi', (now() at time zone 'Asia/Kolkata')::date, 'a4000000-0000-4000-8000-000000000001')), 1, 'but a retry of the first request still returns receipt 1');
select tests.reset();

-- Exact paise: 10,00,000 rupees in three parts
select tests.act_as(tests.tutor_a());
select is((select balance_after from public.record_payment('a2000000-0000-4000-8000-000000000004', 33333300, 'upi', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())), 66666700, 'first part leaves 66666700 paise');
select is((select balance_after from public.record_payment('a2000000-0000-4000-8000-000000000004', 33333300, 'upi', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())), 33333400, 'second part leaves 33333400 paise');
select tests.reset();
select is((select amount_paid || '/' || status from public.dues where id = 'a2000000-0000-4000-8000-000000000004'), '66666600/partial', 'after two parts the due is partial at 66666600');
select tests.act_as(tests.tutor_a());
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000004', 33333401, 'upi', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'amount_over_remaining', 'a paisa more than the last part is refused');
select is((select balance_after from public.record_payment('a2000000-0000-4000-8000-000000000004', 33333400, 'upi', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())), 0, 'third part leaves 0');
select tests.reset();
select is((select amount_paid || '/' || amount || '/' || status from public.dues where id = 'a2000000-0000-4000-8000-000000000004'), '100000000/100000000/paid', 'the due ends paid, amount_paid equal to amount');

-- B gets its own number 1, and cannot reach A
select tests.act_as(tests.tutor_b());
select is((select receipt_no from public.record_payment('b2000000-0000-4000-8000-000000000001', 90000, 'cash', (now() at time zone 'Asia/Kolkata')::date, 'a4000000-0000-4000-8000-000000000001')), 1, 'B first payment is also number 1 (and may use any request id, even one A used)');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 1, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'P0001', 'due_not_found', 'B cannot pay A due');
select tests.reset();

-- A later monthly_fee change and an "Already owes" change leave the due as it was (criterion 11)
insert into public.students (id, tutor_id, name, monthly_fee, opening_balance) values
  ('a1000000-0000-4000-8000-000000000005', tests.tutor_a(), 'A five', 120000, 50000);
select ok((select count(*) = 1 from public.dues where student_id = 'a1000000-0000-4000-8000-000000000005' and kind = 'opening' and amount = 50000), 'the opening due exists for the student');
select tests.act_as(tests.tutor_a());
select lives_ok($$select public.record_payment((select id from public.dues where student_id = 'a1000000-0000-4000-8000-000000000005' and kind = 'opening'), 10000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())$$, 'A pays part of the opening due');
select lives_ok($$update public.students set opening_balance = 99000, monthly_fee = 500000 where id = 'a1000000-0000-4000-8000-000000000005'$$, 'A changes Already owes and the monthly fee afterwards');
select tests.reset();
select is((select amount || '/' || amount_paid || '/' || status from public.dues where student_id = 'a1000000-0000-4000-8000-000000000005' and kind = 'opening'), '50000/10000/partial', 'the opening due is unchanged');
select is((select count(*) from public.payments p join public.dues d on d.id = p.due_id where d.student_id = 'a1000000-0000-4000-8000-000000000005' and p.balance_after = 40000)::int, 1, 'and the payment still says 40000 left');

-- The dues checks still hold for every due touched
select is_empty($$select id from public.dues where not ((status = 'due' and amount_paid = 0) or (status = 'partial' and amount_paid > 0 and amount_paid < amount) or (status = 'paid' and amount_paid = amount))$$, 'status always agrees with amount_paid');
select is_empty($$select d.id from public.dues d where d.amount_paid <> coalesce((select sum(p.amount) from public.payments p where p.due_id = d.id and p.voided_at is null), 0) and d.id in (select due_id from public.payments)$$, 'amount_paid equals the sum of live payments on every due that has payments');

select * from finish();
rollback;
