-- R1-7 Part A criteria 8, 9, 10 (docs/specs/R1-7-record-payment.md, plan sections 2 and 6). void_payment: the owner
-- undoes a payment within 24 hours, once; the fee goes back to due or partial; the receipt number stays used; every
-- refusal changes nothing; the immutability trigger lets only voided_at change. Self-contained; rolls back.
begin;
select tests.assert_ready();
select plan(36);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
insert into public.students (id, tutor_id, name, active) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'A one', true);
insert into public.dues (id, tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values
  ('a2000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 120000, 0, 'due', '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-09-01', 100000, 0, 'due', '2026-09-05');

select is(pg_get_function_result('public.void_payment(uuid)'::regprocedure), 'payments', 'void_payment returns a payments row');
select ok((select prosecdef and coalesce(proconfig::text, '') like '%search_path%' from pg_proc where oid = 'public.void_payment(uuid)'::regprocedure), 'void_payment is security definer with a fixed search_path');
select ok(has_function_privilege('authenticated', 'public.void_payment(uuid)', 'execute'), 'authenticated can execute void_payment');
select ok(not has_function_privilege('anon', 'public.void_payment(uuid)', 'execute'), 'anon cannot execute void_payment');

-- Three payments on the first due (numbers 1, 2, 3) and one on the second (number 4)
select tests.act_as(tests.tutor_a());
select lives_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 30000, 'upi', (now() at time zone 'Asia/Kolkata')::date, 'a4000000-0000-4000-8000-000000000001')$$, 'A records receipt 1');
select lives_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 40000, 'cash', (now() at time zone 'Asia/Kolkata')::date, 'a4000000-0000-4000-8000-000000000002')$$, 'A records receipt 2');
select lives_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000001', 50000, 'cash', (now() at time zone 'Asia/Kolkata')::date, 'a4000000-0000-4000-8000-000000000003')$$, 'A records receipt 3 (the fee is now paid)');
select lives_ok($$select public.record_payment('a2000000-0000-4000-8000-000000000002', 100000, 'cash', (now() at time zone 'Asia/Kolkata')::date, 'a4000000-0000-4000-8000-000000000004')$$, 'A records receipt 4 on another due');
select tests.reset();
select is((select status from public.dues where id = 'a2000000-0000-4000-8000-000000000001'), 'paid', 'the first fee is paid');

-- Void the middle one
select tests.act_as(tests.tutor_a());
select is((select voided_at is not null from public.void_payment((select id from public.payments where receipt_no = 2 and tutor_id = tests.tutor_a()))), true, 'A voids receipt 2 and gets the row back with voided_at set');
select tests.reset();
select is((select amount_paid || '/' || status from public.dues where id = 'a2000000-0000-4000-8000-000000000001'), '80000/partial', 'the fee drops to 80000 and is partial');
select is((select last_no from public.receipt_counters where tutor_id = tests.tutor_a()), 4, 'the counter is unchanged at 4');
select is((select count(*) from public.payments where tutor_id = tests.tutor_a())::int, 4, 'no payment was deleted');
select is((select balance_after from public.payments where receipt_no = 3 and tutor_id = tests.tutor_a()), 0, 'receipt 3 still says balance 0 (history is not rewritten)');
select ok((select voided_at is not null and voided_at <= now() from public.payments where receipt_no = 2 and tutor_id = tests.tutor_a()), 'receipt 2 carries the time it was voided');

-- The next number is 5, never 2
select tests.act_as(tests.tutor_a());
select is((select receipt_no from public.record_payment('a2000000-0000-4000-8000-000000000001', 40000, 'cash', (now() at time zone 'Asia/Kolkata')::date, gen_random_uuid())), 5, 'the next receipt is number 5, not 2');
select tests.reset();

-- A retry of the voided payment request still returns the voided row (same number), and does not charge again
select tests.act_as(tests.tutor_a());
select is((select receipt_no || '/' || (voided_at is not null)::text from public.record_payment('a2000000-0000-4000-8000-000000000001', 40000, 'cash', (now() at time zone 'Asia/Kolkata')::date, 'a4000000-0000-4000-8000-000000000002')), '2/true', 'the old request id returns receipt 2 as voided');
select tests.reset();
select is((select amount_paid from public.dues where id = 'a2000000-0000-4000-8000-000000000001'), 120000, 'and charged nothing (the fee is back to 120000 from the new receipt 5)');

-- Refusals
select tests.act_as(tests.tutor_a());
select throws_ok($$select public.void_payment((select id from public.payments where receipt_no = 2 and tutor_id = tests.tutor_a()))$$, 'P0001', 'already_voided', 'a second void is refused');
select throws_ok($$select public.void_payment('99999999-9999-4999-8999-999999999999')$$, 'P0001', 'payment_not_found', 'an unknown payment is refused');
select throws_ok($$select public.void_payment(null)$$, 'P0001', 'invalid_argument', 'a null payment is refused');
select tests.reset();
select set_config('tests.a_payment_1', (select id::text from public.payments where receipt_no = 1 and tutor_id = tests.tutor_a()), true);
select tests.act_as(tests.tutor_b());
select throws_ok($$select public.void_payment(current_setting('tests.a_payment_1')::uuid)$$, 'P0001', 'payment_not_found', 'B cannot void A payment (same word as unknown)');
select tests.reset();
select tests.act_as_anon();
select throws_ok($$select public.void_payment('99999999-9999-4999-8999-999999999999')$$, '42501', null, 'no session cannot void');
select tests.reset();
select tests.act_as(tests.tutor_a());
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.void_payment('99999999-9999-4999-8999-999999999999')$$, '42501', 'not_signed_in', 'a token with no sub is refused');
select tests.reset();
select is((select count(*) from public.payments where voided_at is not null)::int, 1, 'only receipt 2 is voided after all the refusals');
select is((select amount_paid from public.dues where id = 'a2000000-0000-4000-8000-000000000001'), 120000, 'and the fee is unchanged by them');

-- The 24 hour window, using a payment made 25 hours ago and one made 23 hours ago (the owner moves created_at;
-- the immutability trigger is switched off for that, inside this transaction only)
set constraints all immediate;
alter table public.payments disable trigger payments_immutable;
update public.payments set created_at = now() - interval '25 hours' where receipt_no = 1 and tutor_id = tests.tutor_a();
update public.payments set created_at = now() - interval '23 hours 59 minutes' where receipt_no = 3 and tutor_id = tests.tutor_a();
alter table public.payments enable trigger payments_immutable;
select tests.act_as(tests.tutor_a());
select throws_ok($$select public.void_payment((select id from public.payments where receipt_no = 1 and tutor_id = tests.tutor_a()))$$, 'P0001', 'undo_window_over', 'a payment 25 hours old cannot be undone');
select lives_ok($$select public.void_payment((select id from public.payments where receipt_no = 3 and tutor_id = tests.tutor_a()))$$, 'a payment 23 hours 59 minutes old can');
select tests.reset();
select is((select amount_paid || '/' || status from public.dues where id = 'a2000000-0000-4000-8000-000000000001'), '70000/partial', 'the fee is 70000 (receipts 1 and 5 live) and partial');

-- Voiding the only payment of a fee returns it to due
select tests.act_as(tests.tutor_a());
select lives_ok($$select public.void_payment((select id from public.payments where receipt_no = 4 and tutor_id = tests.tutor_a()))$$, 'A voids receipt 4, the only payment on the second fee');
select tests.reset();
select is((select amount_paid || '/' || status from public.dues where id = 'a2000000-0000-4000-8000-000000000002'), '0/due', 'that fee is back to due with nothing paid');

-- The immutability trigger (the owner is held to it too)
select throws_ok($$update public.payments set amount = 1 where receipt_no = 5 and tutor_id = tests.tutor_a()$$, 'P0001', 'payment_immutable', 'amount cannot be changed');
select throws_ok($$update public.payments set receipt_no = 99 where receipt_no = 5 and tutor_id = tests.tutor_a()$$, 'P0001', 'payment_immutable', 'receipt_no cannot be changed');
select throws_ok($$update public.payments set voided_at = null where receipt_no = 2 and tutor_id = tests.tutor_a()$$, 'P0001', 'payment_immutable', 'a voided payment cannot be un-voided');
select throws_ok($$update public.payments set voided_at = now() + interval '1 hour' where receipt_no = 2 and tutor_id = tests.tutor_a()$$, 'P0001', 'payment_immutable', 'a voided payment cannot be voided again with a new time');
select lives_ok($$update public.payments set voided_at = now() where receipt_no = 5 and tutor_id = tests.tutor_a()$$, 'but voided_at can be set once, null to a time');

select * from finish();
rollback;
