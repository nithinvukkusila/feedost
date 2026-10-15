-- R1-10 Part A criterion 11 (docs/specs/R1-10-paid-claims-inbox.md, plan sections 3 and 9). reject_claim: a tutor's own pending claim goes
-- to rejected and nothing else changes (no payment, no fee, no receipt number); again, another tutor's claim, an unknown claim and
-- anonymous callers are refused with no change; another tutor's claim and an unknown one give the same word; a rejected claim frees
-- its UPI reference.
-- Self-contained: makes its own users and rolls everything back. The error words are the contract at the top of
-- 20261015170625_r1_payment_claims.sql.
begin;
select tests.assert_ready();
select plan(25);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
insert into public.students (id, tutor_id, name) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'A one'),
  ('a1000000-0000-4000-8000-000000000002', tests.tutor_a(), 'A two'),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'B one');
insert into public.dues (id, tutor_id, student_id, kind, month, amount, due_date) values
  ('a2000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 120000, '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('b2000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 90000, '2026-10-05');
insert into public.payment_claims (id, tutor_id, student_id, due_id, amount, fee_count, upi_ref) values
  ('a6000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 120000, 1, '628104739915'),
  ('a6000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 100000, 1, '111111111111'),
  ('b6000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 90000, 1, '222222222222');
insert into public.payment_claims (id, tutor_id, student_id, due_id, amount, fee_count, upi_ref, status, handled_at, confirm_request_id, confirmed_receipt_from, confirmed_receipt_count) values
  ('a6000000-0000-4000-8000-000000000003', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 120000, 1, '333333333333', 'confirmed', now(), 'a4000000-0000-4000-8000-000000000003', 7, 1);

-- The function and who may run it
select is(pg_get_function_result('public.reject_claim(uuid)'::regprocedure), 'payment_claims', 'reject_claim returns a payment_claims row');
select ok((select prosecdef and coalesce(proconfig::text, '') like '%search_path%' from pg_proc where oid = 'public.reject_claim(uuid)'::regprocedure), 'reject_claim is security definer with a fixed search_path');
select ok(has_function_privilege('authenticated', 'public.reject_claim(uuid)', 'execute'), 'authenticated can execute reject_claim');
select ok(not has_function_privilege('anon', 'public.reject_claim(uuid)', 'execute'), 'anon cannot execute reject_claim');
select ok(not has_function_privilege('public', 'public.reject_claim(uuid)', 'execute'), 'public cannot execute reject_claim');

-- Not signed in, bad arguments
select tests.act_as_anon();
select throws_ok($$select public.reject_claim('a6000000-0000-4000-8000-000000000001')$$, '42501', null, 'no session cannot reject a claim');
select tests.reset();
select tests.act_as(tests.tutor_a());
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.reject_claim('a6000000-0000-4000-8000-000000000001')$$, '42501', 'not_signed_in', 'a token with no sub is refused');
select tests.reset();
select tests.act_as(tests.tutor_a());
select throws_ok($$select public.reject_claim(null)$$, 'P0001', 'invalid_argument', 'a null claim is invalid_argument');

-- Another tutor's claim and an unknown one: the same word, nothing changed
select throws_ok($$select public.reject_claim('b6000000-0000-4000-8000-000000000001')$$, 'P0001', 'claim_not_found', 'tutor A cannot reject tutor B claim');
select throws_ok($$select public.reject_claim('a6000000-0000-4000-8000-0000000000ff')$$, 'P0001', 'claim_not_found', 'an unknown claim gives the same word');
select tests.reset();
select tests.act_as(tests.tutor_b());
select throws_ok($$select public.reject_claim('a6000000-0000-4000-8000-000000000001')$$, 'P0001', 'claim_not_found', 'tutor B cannot reject tutor A claim');
select tests.reset();
select is((select status from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000001'), 'pending', 'tutor A claim is still pending');
select is((select status from public.payment_claims where id = 'b6000000-0000-4000-8000-000000000001'), 'pending', 'tutor B claim is still pending');

-- Own pending claim
select tests.act_as(tests.tutor_a());
select is((select status || '/' || (handled_at is not null)::text from public.reject_claim('a6000000-0000-4000-8000-000000000001')), 'rejected/true', 'the tutor rejects her own pending claim');
select tests.reset();
select is((select status || '/' || amount || '/' || upi_ref || '/' || (handled_at is not null)::text || '/' || coalesce(confirm_request_id::text, 'none') from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000001'),
  'rejected/120000/628104739915/true/none', 'the row is rejected, handled, with nothing else changed and no receipt range');
select is((select count(*) from public.payments)::int + (select count(*) from public.receipt_counters)::int, 0, 'a reject made no payment and took no receipt number');
select is((select amount_paid || '/' || status from public.dues where id = 'a2000000-0000-4000-8000-000000000001'), '0/due', 'the fee is unchanged');

-- Again, and a claim that was confirmed
select tests.act_as(tests.tutor_a());
select throws_ok($$select public.reject_claim('a6000000-0000-4000-8000-000000000001')$$, 'P0001', 'already_handled', 'rejecting a rejected claim is already_handled');
select throws_ok($$select public.reject_claim('a6000000-0000-4000-8000-000000000003')$$, 'P0001', 'already_handled', 'rejecting a confirmed claim is already_handled');
select tests.reset();
select is((select status from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000003'), 'confirmed', 'the confirmed claim is still confirmed');
select is((select count(*) from public.payment_claims where status = 'rejected')::int, 1, 'only one claim is rejected');
select is((select status from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000002'), 'pending', 'the other pending claim of the tutor is untouched');

-- The reference is free again, and the student can claim again
select lives_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 120000, 1, '628104739915')$$, 'a rejected claim frees its reference and its student can have a new pending claim');

-- A rejected claim cannot be confirmed afterwards
select tests.act_as(tests.tutor_a());
select throws_ok($$select public.confirm_claim('a6000000-0000-4000-8000-000000000001', gen_random_uuid())$$, 'P0001', 'already_handled', 'a rejected claim cannot be confirmed');
select tests.reset();
select is((select count(*) from public.payments)::int, 0, 'and still no payment exists');

select * from finish();
rollback;
