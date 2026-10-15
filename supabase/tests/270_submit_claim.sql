-- R1-10 Part A criteria 5, 6 and 7 (docs/specs/R1-10-paid-claims-inbox.md, plan sections 3 and 9). submit_claim: only the service role
-- can run it; every refusal code, in order, with nothing written; the amount is the exact sum over all open fees and the fee is the
-- oldest; the reference is normalised; one pending claim per student; a reference is unique per tutor and a rejected claim frees it.
-- Self-contained: makes its own users and rolls everything back. Answers are read as the test runner, which owns the security definer
-- function; the privilege checks use service_role, anon and the tutors.
begin;
select tests.assert_ready();
select plan(70);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
insert into public.students (id, tutor_id, name, active, pay_token) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'Ravi',      true,  'ClmRaviToken_aaaaaaaaaaa'),
  ('a1000000-0000-4000-8000-000000000002', tests.tutor_a(), 'Meena',     true,  'ClmMeenaToken_aaaaaaaaaa'),
  ('a1000000-0000-4000-8000-000000000003', tests.tutor_a(), 'NoConsent', true,  'ClmNoConsentTok_aaaaaaaaa'),
  ('a1000000-0000-4000-8000-000000000004', tests.tutor_a(), 'Settled',   true,  'ClmSettledToken_aaaaaaaaa'),
  ('a1000000-0000-4000-8000-000000000005', tests.tutor_a(), 'Oldie',     false, 'ClmOldieToken_aaaaaaaaaa'),
  ('a1000000-0000-4000-8000-000000000006', tests.tutor_a(), 'Big',       true,  'ClmBigToken_aaaaaaaaaaaa'),
  ('a1000000-0000-4000-8000-000000000007', tests.tutor_a(), 'Cap',       true,  'ClmCapToken_aaaaaaaaaaaa'),
  ('a1000000-0000-4000-8000-000000000008', tests.tutor_a(), 'Part',      true,  'ClmPartToken_aaaaaaaaaaa'),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'Bhanu',     true,  'ClmBhanuToken_bbbbbbbbb');

insert into public.dues (id, tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values
  -- Ravi: an earlier balance part paid (20000 left), September open (90000), October part paid (70000 left), August paid
  ('a2000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'opening', null,         30000,  10000, 'partial', '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-09-01', 90000,  0,     'due',     '2026-09-05'),
  ('a2000000-0000-4000-8000-000000000003', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 120000, 50000, 'partial', '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000004', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-08-01', 100000, 100000, 'paid',   '2026-08-05'),
  -- Meena, NoConsent, Oldie: one open fee each; Settled: nothing owed
  ('a2000000-0000-4000-8000-000000000005', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'monthly', '2026-10-01', 80000,  0,     'due',     '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000006', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'monthly', '2026-10-01', 80000,  0,     'due',     '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000007', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000004', 'monthly', '2026-10-01', 80000,  80000, 'paid',    '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000008', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000005', 'monthly', '2026-10-01', 80000,  0,     'due',     '2026-10-05'),
  -- Big: Rs 10,00,000 (the older) and Rs 1
  ('a2000000-0000-4000-8000-000000000009', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000006', 'monthly', '2026-08-01', 100000000, 0,  'due',     '2026-08-05'),
  ('a2000000-0000-4000-8000-00000000000a', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000006', 'monthly', '2026-09-01', 100,       0,  'due',     '2026-09-05'),
  -- Part: one fee, part paid
  ('a2000000-0000-4000-8000-00000000000b', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000008', 'monthly', '2026-10-01', 120000, 50000, 'partial', '2026-10-05'),
  ('b2000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 70000,  0,     'due',     '2026-10-05');
-- Cap: 22 open fees at the cap, 2,200,000,000 paise, more than an integer holds
insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date)
select tests.tutor_a(), 'a1000000-0000-4000-8000-000000000007', 'monthly', (date '2024-01-01' + g * interval '1 month')::date, 100000000, 0, 'due',
       (date '2024-01-05' + g * interval '1 month')::date
  from generate_series(0, 21) g;

insert into public.consents (tutor_id, student_id, notice_version) values
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', public.current_notice_version()),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', public.current_notice_version()),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000004', public.current_notice_version()),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000005', public.current_notice_version()),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000006', public.current_notice_version()),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000007', public.current_notice_version()),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000008', public.current_notice_version()),
  (tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', public.current_notice_version());

-- Privileges and shape
select ok(has_function_privilege('service_role', 'public.submit_claim(text, text, text)', 'execute'), 'service_role can execute submit_claim');
select ok(not has_function_privilege('anon', 'public.submit_claim(text, text, text)', 'execute'), 'anon cannot execute submit_claim');
select ok(not has_function_privilege('authenticated', 'public.submit_claim(text, text, text)', 'execute'), 'authenticated cannot execute submit_claim');
select ok(not has_function_privilege('public', 'public.submit_claim(text, text, text)', 'execute'), 'public cannot execute submit_claim');
select ok(has_function_privilege('service_role', 'public.claim_hit(text, integer)', 'execute'), 'service_role can execute claim_hit');
select ok(not has_function_privilege('anon', 'public.claim_hit(text, integer)', 'execute') and not has_function_privilege('authenticated', 'public.claim_hit(text, integer)', 'execute'), 'neither anon nor authenticated can execute claim_hit');
select ok(not has_function_privilege('anon', 'public.open_dues_oldest_first(uuid, uuid)', 'execute') and not has_function_privilege('authenticated', 'public.open_dues_oldest_first(uuid, uuid)', 'execute'), 'no client can execute open_dues_oldest_first');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.submit_claim(text, text, text)'::regprocedure), 'submit_claim is security definer with an empty search_path');
select is(pg_get_function_arguments('public.submit_claim(text, text, text)'::regprocedure), 'p_token text, p_upi_ref text, p_screenshot_path text', 'submit_claim takes a token, a reference and a path: no amount, student, tutor or time');
select is(pg_get_function_result('public.submit_claim(text, text, text)'::regprocedure), 'text', 'submit_claim returns one text code and no data');

select tests.act_as_anon();
select throws_ok($$select public.submit_claim('ClmRaviToken_aaaaaaaaaaa', '628104739915', null)$$, '42501', null, 'anon cannot call submit_claim');
select tests.reset();
select tests.act_as(tests.tutor_a());
select throws_ok($$select public.submit_claim('ClmRaviToken_aaaaaaaaaaa', '628104739915', null)$$, '42501', null, 'a tutor cannot call submit_claim, not even for own student');
select tests.reset();
set local role service_role;
select is(public.submit_claim('ClmNoSuchToken_aaaaaaaaaa', '628104739915', null), 'not_found', 'service_role can call it');
reset role;

-- not_found: unknown, malformed, archived. All the same answer, nothing written
select is(public.submit_claim('ClmNoSuchToken_aaaaaaaaaa', '628104739915', null), 'not_found', 'an unknown token is not_found');
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa ', '628104739915', null), 'not_found', 'a trailing space is not_found');
select is(public.submit_claim('clmravitoken_aaaaaaaaaaa', '628104739915', null), 'not_found', 'a different case is not_found');
select is(public.submit_claim('ClmRaviToken_aaaaaaaaa', '628104739915', null), 'not_found', 'a 22 character prefix of nothing is not_found');
select is(public.submit_claim('ClmRaviToken_aaaa', '628104739915', null), 'not_found', 'a 17 character token is not_found');
select is(public.submit_claim('', '628104739915', null), 'not_found', 'an empty token is not_found');
select is(public.submit_claim(null, '628104739915', null), 'not_found', 'a null token is not_found');
select is(public.submit_claim('%', '628104739915', null), 'not_found', 'a wildcard is not_found');
select is(public.submit_claim($$' or 1=1 --$$, '628104739915', null), 'not_found', 'an injection attempt is not_found');
select is(public.submit_claim('ClmOldieToken_aaaaaaaaaa', '628104739915', null), 'not_found', 'an archived student is not_found');
select is(public.submit_claim('ClmNoSuchToken_aaaaaaaaaa', 'not a reference', null), 'not_found', 'the token is checked before the reference');
select is((select count(*) from public.payment_claims)::int, 0, 'nothing was written by any not_found');

-- consent, nothing owed
select is(public.submit_claim('ClmNoConsentTok_aaaaaaaaa', '628104739915', null), 'consent_needed', 'a student whose parent has not agreed gets consent_needed');
select is(public.submit_claim('ClmNoConsentTok_aaaaaaaaa', 'not a reference', null), 'consent_needed', 'consent is checked before the reference');
select is(public.submit_claim('ClmSettledToken_aaaaaaaaa', '628104739915', null), 'nothing_owed', 'a fully paid student gets nothing_owed');
select is(public.submit_claim('ClmSettledToken_aaaaaaaaa', 'not a reference', null), 'nothing_owed', 'nothing owed is checked before the reference');

-- bad_reference and no_proof (Ravi owes money and has agreed)
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', '62810473991', null), 'bad_reference', '11 digits is bad_reference');
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', '6281047399151', null), 'bad_reference', '13 digits is bad_reference');
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', '62810473991a', null), 'bad_reference', 'a letter is bad_reference');
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', E'०१२३४५६७८९०१', null), 'bad_reference', 'twelve Devanagari digits is bad_reference');
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', E'6281\t0473\t9915', null), 'bad_reference', 'tabs are not removed: bad_reference');
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', '6281.0473.9915', null), 'bad_reference', 'dots are not removed: bad_reference');
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', null, null), 'no_proof', 'no reference and no file is no_proof');
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', '', null), 'no_proof', 'an empty reference is no_proof');
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', ' - - ', null), 'no_proof', 'only spaces and hyphens is no_proof');
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', null, tests.tutor_b()::text || '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png'), 'no_proof', 'a file under another tutor folder is no_proof');
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', null, '../../etc/passwd'), 'no_proof', 'a file path of the wrong shape is no_proof');
select is((select count(*) from public.payment_claims)::int, 0, 'nothing was written by any refusal so far');
select is((select count(*) from public.payments)::int + (select count(*) from public.receipt_counters)::int, 0, 'no payment and no receipt number was made');

-- ok: the amount is the sum over all open fees, the fee is the oldest, the reference is normalised
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', '6281 0473 9915', null), 'ok', 'a spaced reference is ok');
select is((select amount || '/' || fee_count || '/' || due_id || '/' || upi_ref || '/' || status from public.payment_claims where student_id = 'a1000000-0000-4000-8000-000000000001'),
  '180000/3/a2000000-0000-4000-8000-000000000001/628104739915/pending', 'the claim is 20000 + 90000 + 70000 over 3 fees, on the earlier balance, with 12 digits, pending');
select is((select tutor_id from public.payment_claims where student_id = 'a1000000-0000-4000-8000-000000000001'), tests.tutor_a(), 'the tutor comes from the student');
select is((select screenshot_path from public.payment_claims where student_id = 'a1000000-0000-4000-8000-000000000001'), null, 'there is no screenshot');
select is((select handled_at from public.payment_claims where student_id = 'a1000000-0000-4000-8000-000000000001'), null, 'it has not been handled');
select is((select amount_paid || '/' || status from public.dues where id = 'a2000000-0000-4000-8000-000000000001'), '10000/partial', 'the fee itself is not touched by a claim');

-- one pending claim per student; already_pending beats duplicate_reference
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', '999999999999', null), 'already_pending', 'a second claim while one waits is already_pending');
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', '628104739915', null), 'already_pending', 'a retry with the same reference is already_pending, not duplicate_reference');
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', 'junk', null), 'bad_reference', 'a bad reference is still bad_reference while one waits');
select is((select count(*) from public.payment_claims)::int, 1, 'still one claim');

-- duplicate_reference: per tutor, in any of the three written forms; another tutor is free; a rejected claim frees it
select is(public.submit_claim('ClmPartToken_aaaaaaaaaaa', '628104739915', null), 'duplicate_reference', 'the same reference for another student of the tutor is duplicate_reference');
select is(public.submit_claim('ClmPartToken_aaaaaaaaaaa', '6281-0473-9915', null), 'duplicate_reference', 'with hyphens it is the same reference');
select is(public.submit_claim('ClmPartToken_aaaaaaaaaaa', ' 6281 0473 9915 ', null), 'duplicate_reference', 'with spaces around it is the same reference');
select is((select count(*) from public.payment_claims)::int, 1, 'no duplicate was written');
select is(public.submit_claim('ClmBhanuToken_bbbbbbbbb', '628104739915', null), 'ok', 'another tutor can hold the same reference');
update public.payment_claims set status = 'rejected', handled_at = now() where student_id = 'a1000000-0000-4000-8000-000000000001';
select is(public.submit_claim('ClmPartToken_aaaaaaaaaaa', '628104739915', null), 'ok', 'after a reject the reference is free again');
select is((select amount || '/' || fee_count || '/' || due_id from public.payment_claims where student_id = 'a1000000-0000-4000-8000-000000000008'),
  '70000/1/a2000000-0000-4000-8000-00000000000b', 'a part paid fee claims what remains of it');
select is(public.submit_claim('ClmRaviToken_aaaaaaaaaaa', '123412341234', null), 'ok', 'after her claim was rejected the same student can claim again');
select is((select count(*) from public.payment_claims where student_id = 'a1000000-0000-4000-8000-000000000001' and status = 'pending')::int, 1, 'with one pending claim');

-- A screenshot alone is a proof (Part D uploads the file; the path must be under the tutor folder)
select is(public.submit_claim('ClmMeenaToken_aaaaaaaaaa', null, tests.tutor_a()::text || '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png'), 'ok', 'a file under the tutor folder, with no reference, is ok');
select is((select upi_ref is null and screenshot_path = tests.tutor_a()::text || '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png' from public.payment_claims where student_id = 'a1000000-0000-4000-8000-000000000002'), true, 'the path is stored and the reference is null');

-- Exact paise, no float; the integer ceiling
select is(public.submit_claim('ClmBigToken_aaaaaaaaaaaa', '100000100100', null), 'ok', 'Rs 10,00,000 plus Rs 1 is ok');
select is((select amount || '/' || fee_count || '/' || due_id from public.payment_claims where student_id = 'a1000000-0000-4000-8000-000000000006'),
  '100000100/2/a2000000-0000-4000-8000-000000000009', 'the total is exactly 100000100 paise, on the older fee');
select is(public.submit_claim('ClmCapToken_aaaaaaaaaaaa', '200000000001', null), 'ok', 'a total above the integer range is ok');
select is((select amount || '/' || fee_count from public.payment_claims where student_id = 'a1000000-0000-4000-8000-000000000007'), '2000000000/22', 'the claim is capped at 2,000,000,000 paise and counts all 22 fees');

-- Nothing here moved money
select is((select count(*) from public.payments)::int + (select count(*) from public.receipt_counters)::int, 0, 'no claim made a payment or took a receipt number');
select is((select sum(amount_paid) from public.dues where student_id = 'a1000000-0000-4000-8000-000000000001')::int, 160000, 'Ravi fees are exactly as before');

-- A deleted tutor: the link is a not_found
delete from auth.users where id = tests.tutor_b();
select is(public.submit_claim('ClmBhanuToken_bbbbbbbbb', '555555555555', null), 'not_found', 'after the tutor is deleted the link is not_found');

select * from finish();
rollback;
