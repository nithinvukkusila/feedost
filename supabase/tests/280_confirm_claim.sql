-- R1-10 Part A criteria 8, 9 and 10 (docs/specs/R1-10-paid-claims-inbox.md, plan sections 3 and 9). confirm_claim: one payment and one
-- receipt per fee, oldest first, through record_payment (which still runs every check; confirm_claim pre-empts three of them, and the
-- archived and 90-day pairs below pin the two functions together); consecutive receipt numbers from the same counter as Mark paid;
-- every refusal changes nothing and uses no number; a retry with the same request id returns the same claim.
-- Self-contained: makes its own users and rolls everything back. The error words are the contract at the top of
-- 20261015170625_r1_payment_claims.sql. Times are relative to now(), which does not move inside this transaction.
begin;
select tests.assert_ready();
select plan(68);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
insert into public.students (id, tutor_id, name, active) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'One fee',   true),
  ('a1000000-0000-4000-8000-000000000002', tests.tutor_a(), 'Three fees', true),
  ('a1000000-0000-4000-8000-000000000003', tests.tutor_a(), 'Short',     true),
  ('a1000000-0000-4000-8000-000000000004', tests.tutor_a(), 'Archived',  false),
  ('a1000000-0000-4000-8000-000000000005', tests.tutor_a(), 'Old',       true),
  ('a1000000-0000-4000-8000-000000000006', tests.tutor_a(), 'Ninety',    true),
  ('a1000000-0000-4000-8000-000000000007', tests.tutor_a(), 'Overtaken', true),
  ('a1000000-0000-4000-8000-000000000008', tests.tutor_a(), 'Handled',   true),
  ('a1000000-0000-4000-8000-00000000000a', tests.tutor_a(), 'Markpaid',  true),
  ('a1000000-0000-4000-8000-00000000000b', tests.tutor_a(), 'Settled',   true),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'B one',     true);
insert into public.dues (id, tutor_id, student_id, kind, month, amount, due_date) values
  ('a2000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 120000, '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'monthly', '2026-08-01', 100000, '2026-08-05'),
  ('a2000000-0000-4000-8000-000000000003', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'monthly', '2026-09-01', 100000, '2026-09-05'),
  ('a2000000-0000-4000-8000-000000000004', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000005', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'monthly', '2026-09-01', 100000, '2026-09-05'),
  ('a2000000-0000-4000-8000-000000000006', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000007', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000004', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000008', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000005', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000009', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000006', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('a2000000-0000-4000-8000-00000000000a', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000007', 'monthly', '2026-10-01', 120000, '2026-10-05'),
  ('a2000000-0000-4000-8000-00000000000b', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000008', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('a2000000-0000-4000-8000-00000000000d', tests.tutor_a(), 'a1000000-0000-4000-8000-00000000000a', 'monthly', '2026-10-01', 50000,  '2026-10-05'),
  ('a2000000-0000-4000-8000-00000000000e', tests.tutor_a(), 'a1000000-0000-4000-8000-00000000000b', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('b2000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 90000,  '2026-10-05');
-- C1 one fee; C2 three fees; C3 smaller than the total of two fees; C4 archived student; C5 sent 91 days ago; C6 sent 90 days ago;
-- C7 and C11 will be overtaken by a Mark paid; C8 already rejected; C9 already confirmed (request a4...09, number 99); B's claim.
insert into public.payment_claims (id, tutor_id, student_id, due_id, amount, fee_count, upi_ref, created_at) values
  ('a6000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 120000, 1, '100000000001', now()),
  ('a6000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 300000, 3, '100000000002', now()),
  ('a6000000-0000-4000-8000-000000000003', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000005', 150000, 2, '100000000003', now()),
  ('a6000000-0000-4000-8000-000000000004', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000007', 100000, 1, '100000000004', now()),
  ('a6000000-0000-4000-8000-000000000005', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000008', 100000, 1, '100000000005', now() - interval '91 days'),
  ('a6000000-0000-4000-8000-000000000006', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000006', 'a2000000-0000-4000-8000-000000000009', 100000, 1, '100000000006', now() - interval '90 days'),
  ('a6000000-0000-4000-8000-000000000007', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000007', 'a2000000-0000-4000-8000-00000000000a', 120000, 1, '100000000007', now()),
  ('b6000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 90000,  1, '200000000001', now());
insert into public.payment_claims (id, tutor_id, student_id, due_id, amount, fee_count, upi_ref, status, handled_at) values
  ('a6000000-0000-4000-8000-000000000008', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000008', 'a2000000-0000-4000-8000-00000000000b', 100000, 1, '100000000008', 'rejected', now());
insert into public.payment_claims (id, tutor_id, student_id, due_id, amount, fee_count, upi_ref, status, handled_at, confirm_request_id, confirmed_receipt_from, confirmed_receipt_count) values
  ('a6000000-0000-4000-8000-000000000009', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000008', 'a2000000-0000-4000-8000-00000000000b', 100000, 1, '100000000009', 'confirmed', now(), 'a4000000-0000-4000-8000-000000000009', 99, 1);
insert into public.payment_claims (id, tutor_id, student_id, due_id, amount, fee_count, upi_ref) values
  ('a6000000-0000-4000-8000-00000000000a', tests.tutor_a(), 'a1000000-0000-4000-8000-00000000000b', 'a2000000-0000-4000-8000-00000000000e', 100000, 1, '100000000010');

-- The function and who may run it
select is(pg_get_function_result('public.confirm_claim(uuid, uuid)'::regprocedure), 'payment_claims', 'confirm_claim returns a payment_claims row');
select ok((select prosecdef and coalesce(proconfig::text, '') like '%search_path%' from pg_proc where oid = 'public.confirm_claim(uuid, uuid)'::regprocedure), 'confirm_claim is security definer with a fixed search_path');
select ok(has_function_privilege('authenticated', 'public.confirm_claim(uuid, uuid)', 'execute'), 'authenticated can execute confirm_claim');
select ok(not has_function_privilege('anon', 'public.confirm_claim(uuid, uuid)', 'execute'), 'anon cannot execute confirm_claim');
select ok(not has_function_privilege('public', 'public.confirm_claim(uuid, uuid)', 'execute'), 'public cannot execute confirm_claim');
select ok(has_function_privilege('authenticated', 'public.record_payment(uuid, integer, text, date, uuid)', 'execute'), 'record_payment is still executable by authenticated (Mark paid is unchanged)');

-- Not signed in
select tests.act_as_anon();
select throws_ok($$select public.confirm_claim('a6000000-0000-4000-8000-000000000001', gen_random_uuid())$$, '42501', null, 'no session cannot confirm a claim');
select tests.reset();
select tests.act_as(tests.tutor_a());
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.confirm_claim('a6000000-0000-4000-8000-000000000001', gen_random_uuid())$$, '42501', 'not_signed_in', 'a token with no sub is refused');
select tests.reset();

-- Refusals before anything is confirmed: nothing changes, the counter is never made
select tests.act_as(tests.tutor_a());
select throws_ok($$select public.confirm_claim(null, gen_random_uuid())$$, 'P0001', 'invalid_argument', 'a null claim is invalid_argument');
select throws_ok($$select public.confirm_claim('a6000000-0000-4000-8000-000000000001', null)$$, 'P0001', 'invalid_argument', 'a null request id is invalid_argument');
select throws_ok($$select public.confirm_claim('a6000000-0000-4000-8000-0000000000ff', gen_random_uuid())$$, 'P0001', 'claim_not_found', 'an unknown claim is claim_not_found');
select throws_ok($$select public.confirm_claim('b6000000-0000-4000-8000-000000000001', gen_random_uuid())$$, 'P0001', 'claim_not_found', 'another tutor claim is claim_not_found, the same word');
select throws_ok($$select public.confirm_claim('a6000000-0000-4000-8000-000000000004', gen_random_uuid())$$, 'P0001', 'student_archived', 'a claim of an archived student is student_archived');
select throws_ok($$select public.confirm_claim('a6000000-0000-4000-8000-000000000005', gen_random_uuid())$$, 'P0001', 'date_out_of_range', 'a claim sent 91 days ago is date_out_of_range');
select throws_ok($$select public.confirm_claim('a6000000-0000-4000-8000-000000000008', gen_random_uuid())$$, 'P0001', 'already_handled', 'a rejected claim is already_handled');
select throws_ok($$select public.confirm_claim('a6000000-0000-4000-8000-000000000009', gen_random_uuid())$$, 'P0001', 'already_handled', 'a confirmed claim with another request id is already_handled');
select tests.reset();
select tests.act_as(tests.tutor_b());
select throws_ok($$select public.confirm_claim('a6000000-0000-4000-8000-000000000001', gen_random_uuid())$$, 'P0001', 'claim_not_found', 'tutor B cannot confirm tutor A claim');
select tests.reset();
select is((select count(*) from public.payments)::int + (select count(*) from public.receipt_counters)::int, 0, 'no refusal made a payment or a counter row');
select is((select count(*) from public.payment_claims where status = 'pending')::int, 9, 'no refusal changed a claim (nine still pending)');
select is((select sum(amount_paid) from public.dues)::int, 0, 'no refusal charged a fee');

-- Success: one fee
select tests.act_as(tests.tutor_a());
select is((select status from public.confirm_claim('a6000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001')), 'confirmed', 'confirming a one fee claim returns it confirmed');
select tests.reset();
select is((select confirmed_receipt_from || '/' || confirmed_receipt_count || '/' || (handled_at is not null)::text || '/' || confirm_request_id::text from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000001'),
  '1/1/true/a4000000-0000-4000-8000-000000000001', 'the claim holds receipt 1, one payment, a handled time and the request id');
select is((select amount || '/' || method || '/' || receipt_no || '/' || balance_after || '/' || (paid_on = public.india_day(now()))::text from public.payments where due_id = 'a2000000-0000-4000-8000-000000000001'),
  '120000/upi/1/0/true', 'one UPI payment of 120000, receipt 1, nothing left, dated the India day of the claim');
select is((select amount_paid || '/' || status from public.dues where id = 'a2000000-0000-4000-8000-000000000001'), '120000/paid', 'the fee is paid');
select is((select last_no from public.receipt_counters where tutor_id = tests.tutor_a()), 1, 'the counter is at 1');

-- A retry with the same request id: the same row, nothing more
select tests.act_as(tests.tutor_a());
select is((select confirmed_receipt_from from public.confirm_claim('a6000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001')), 1, 'the same request id returns the same claim (receipt 1)');
select is((select status from public.confirm_claim('a6000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001')), 'confirmed', 'and again');
select throws_ok($$select public.confirm_claim('a6000000-0000-4000-8000-000000000001', gen_random_uuid())$$, 'P0001', 'already_handled', 'a different request id on a confirmed claim is already_handled');
select throws_ok($$select public.confirm_claim('a6000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000001')$$, 'P0001', 'request_reused', 'a request id that confirmed another claim is request_reused');
select tests.reset();
select is((select count(*) from public.payments where tutor_id = tests.tutor_a())::int, 1, 'still one payment after retries');
select is((select last_no from public.receipt_counters where tutor_id = tests.tutor_a()), 1, 'the counter did not move on a retry');
select is((select status from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000002'), 'pending', 'request_reused left the other claim pending');

-- Success: three fees, oldest first, consecutive numbers, amounts add up exactly
select tests.act_as(tests.tutor_a());
select is((select confirmed_receipt_from || '/' || confirmed_receipt_count from public.confirm_claim('a6000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000002')), '2/3', 'a three fee claim holds receipts 2 to 4');
select tests.reset();
select is((select string_agg(p.receipt_no || ':' || p.amount || ':' || d.month::text, ',' order by p.receipt_no) from public.payments p join public.dues d on d.id = p.due_id where d.student_id = 'a1000000-0000-4000-8000-000000000002'),
  '2:100000:2026-08-01,3:100000:2026-09-01,4:100000:2026-10-01', 'one payment per fee, oldest first, receipts 2, 3 and 4');
select is((select sum(amount) from public.payments where receipt_no >= 2 and receipt_no < 2 + 3 and tutor_id = tests.tutor_a())::int, 300000, 'the number range finds payments that add up to the claim exactly');
select is((select count(distinct paid_on) || '/' || min(method) from public.payments where receipt_no between 2 and 4 and tutor_id = tests.tutor_a()), '1/upi', 'all three are UPI and share one paid_on');
select is((select count(*) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000002' and status = 'paid')::int, 3, 'all three fees are paid');
select is((select last_no from public.receipt_counters where tutor_id = tests.tutor_a()), 4, 'the counter is at 4');

-- Success: a claim smaller than the total pays the oldest first and leaves the rest open
select tests.act_as(tests.tutor_a());
select is((select confirmed_receipt_from || '/' || confirmed_receipt_count from public.confirm_claim('a6000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000003')), '5/2', 'a 150000 claim over two fees holds receipts 5 and 6');
select tests.reset();
select is((select string_agg(amount::text || '/' || balance_after::text, ',' order by receipt_no) from public.payments where receipt_no in (5, 6) and tutor_id = tests.tutor_a()), '100000/0,50000/50000', 'the older fee is paid in full and the next gets the rest');
select is((select status || '/' || amount_paid from public.dues where id = 'a2000000-0000-4000-8000-000000000006'), 'partial/50000', 'the second fee is part paid');

-- The next Mark paid takes the next number: no reuse, no gap
select tests.act_as(tests.tutor_a());
select is((select receipt_no from public.record_payment('a2000000-0000-4000-8000-00000000000d', 50000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())), 7, 'Mark paid after a confirm takes receipt 7');

-- A Mark paid that overtakes a claim: Confirm is refused, with what is owed, and uses no number
select is((select receipt_no from public.record_payment('a2000000-0000-4000-8000-00000000000a', 50000, 'upi', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())), 8, 'a part payment of the fee under a claim is receipt 8');
select throws_ok($$select public.confirm_claim('a6000000-0000-4000-8000-000000000007', gen_random_uuid())$$, 'P0001', 'amount_over_remaining', 'a claim bigger than what is owed now is amount_over_remaining');
select tests.reset();
do $$
declare v_detail text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
  begin
    perform public.confirm_claim('a6000000-0000-4000-8000-000000000007', gen_random_uuid());
  exception when others then
    get stacked diagnostics v_detail = pg_exception_detail;
  end;
  perform set_config('tests.detail', coalesce(v_detail, 'none'), true);
  perform set_config('request.jwt.claims', '', true);
end $$;
select is(current_setting('tests.detail'), '70000', 'amount_over_remaining carries the paise owed now (70000) as its detail');
select is((select status from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000007'), 'pending', 'the overtaken claim is still pending');
select is((select last_no from public.receipt_counters where tutor_id = tests.tutor_a()), 8, 'and the counter is still at 8');
select is((select count(*) from public.payments where due_id = 'a2000000-0000-4000-8000-00000000000a')::int, 1, 'and only the Mark paid payment exists for that fee');

-- A fee paid in full by Mark paid: Confirm says nothing is owed
select tests.act_as(tests.tutor_a());
select is((select receipt_no from public.record_payment('a2000000-0000-4000-8000-00000000000e', 100000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())), 9, 'a fee paid in full by hand is receipt 9');
select throws_ok($$select public.confirm_claim('a6000000-0000-4000-8000-00000000000a', gen_random_uuid())$$, 'P0001', 'amount_over_remaining', 'a claim for a fee already paid is amount_over_remaining');
select tests.reset();
select is((select last_no from public.receipt_counters where tutor_id = tests.tutor_a()), 9, 'and the counter is still at 9');

-- The 90 day edge: sent 90 days ago is allowed and is dated that India day
select tests.act_as(tests.tutor_a());
select is((select confirmed_receipt_from from public.confirm_claim('a6000000-0000-4000-8000-000000000006', 'a4000000-0000-4000-8000-000000000006')), 10, 'a claim sent exactly 90 days ago is confirmed (receipt 10)');
select tests.reset();
select is((select paid_on from public.payments where receipt_no = 10 and tutor_id = tests.tutor_a()), public.india_day(now() - interval '90 days'), 'it is dated the India day it was sent');

-- confirm_claim pre-empts record_payment's archived and 90-day checks (the C4, C5 and C6 cases above). THESE PAIRS MUST AGREE:
-- record_payment called directly on the same days gives the same answers, so a change to either rule fails here. Run as the test
-- runner with tutor A's session claims, so india_day can be called. The accepted call is undone by a sentinel error, so it uses no
-- receipt number and the numbering below is unchanged.
do $$
declare v_result text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
  begin
    perform public.record_payment('a2000000-0000-4000-8000-00000000000a', 1000, 'upi', public.india_day(now()) - 90, gen_random_uuid());
    raise exception 'tests_undo' using errcode = 'TS001';
  exception
    when sqlstate 'TS001' then v_result := 'accepted';
    when others then v_result := sqlerrm;
  end;
  perform set_config('tests.paid_90', v_result, true);
  perform set_config('request.jwt.claims', '', true);
end $$;
select is(current_setting('tests.paid_90'), 'accepted', 'record_payment accepts paid_on 90 India days ago, as confirm_claim accepts a claim sent 90 days ago');
select set_config('request.jwt.claims', json_build_object('sub', tests.tutor_a(), 'role', 'authenticated')::text, true);
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-00000000000a', 1000, 'upi', public.india_day(now()) - 91, gen_random_uuid())$$, 'P0001', 'date_out_of_range', 'record_payment refuses paid_on 91 India days ago with date_out_of_range, as confirm_claim does');
select throws_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000007', 1000, 'upi', public.india_day(now()), gen_random_uuid())$$, 'P0001', 'student_archived', 'record_payment refuses an archived student with student_archived, as confirm_claim does');
select tests.reset();
select is((select last_no || '/' || (select count(*) from public.payments where tutor_id = tests.tutor_a()) from public.receipt_counters where tutor_id = tests.tutor_a()), '10/10', 'the direct calls left no payment and used no receipt number');

-- Undo of one payment of a claim leaves the claim confirmed; the next Mark paid still gets a new number
select tests.act_as(tests.tutor_a());
select is((select voided_at is not null from public.void_payment((select id from public.payments where tutor_id = tests.tutor_a() and receipt_no = 5))), true, 'a payment made by a confirm can be undone');
select tests.reset();
select is((select status from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000003'), 'confirmed', 'the claim stays confirmed after an undo');
select is((select amount_paid || '/' || status from public.dues where id = 'a2000000-0000-4000-8000-000000000005'), '0/due', 'the fee is owed again');
select tests.act_as(tests.tutor_a());
select is((select receipt_no from public.record_payment('a2000000-0000-4000-8000-000000000005', 100000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())), 11, 'paying it again by hand takes receipt 11, not 5');
select tests.reset();

-- Tutor B is untouched by all of it
select is((select status from public.payment_claims where id = 'b6000000-0000-4000-8000-000000000001'), 'pending', 'tutor B claim is still pending');
select is((select count(*) from public.payments where tutor_id = tests.tutor_b())::int + (select count(*) from public.receipt_counters where tutor_id = tests.tutor_b())::int, 0, 'tutor B has no payment and no counter row');
select tests.act_as(tests.tutor_b());
select is((select confirmed_receipt_from from public.confirm_claim('b6000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001')), 1, 'tutor B first confirm is receipt 1 of her own counter');
select tests.reset();
select is((select last_no from public.receipt_counters where tutor_id = tests.tutor_b()), 1, 'tutor B counter is at 1');
select is((select last_no from public.receipt_counters where tutor_id = tests.tutor_a()), 11, 'tutor A counter is at 11');

-- Receipt numbers over all the work are 1 to 11 with no gap and no repeat
select is((select string_agg(receipt_no::text, ',' order by receipt_no) from public.payments where tutor_id = tests.tutor_a()), '1,2,3,4,5,6,7,8,9,10,11', 'tutor A receipts are 1 to 11 with no gap and no repeat');

-- Claim rows are never edited by a confirm beyond the handled columns
select is((select amount || '/' || upi_ref || '/' || fee_count from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000003'), '150000/100000000003/2', 'a confirm did not change what was claimed');

select * from finish();
rollback;
