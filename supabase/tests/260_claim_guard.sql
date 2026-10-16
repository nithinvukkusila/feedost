-- R1-10 Part A criteria 3 and 4 (docs/specs/R1-10-paid-claims-inbox.md, plan section 3 and 9). The payment_claims_guard trigger lets a
-- claim go pending -> confirmed or rejected once and changes nothing about what was claimed, even for the table owner; the database
-- itself allows one pending claim per student; a UPI reference is on one live (pending or confirmed) claim per tutor.
-- Self-contained: makes its own users and rolls everything back. Runs as the test runner (the table owner), so the trigger and the
-- indexes are what refuse, not a grant.
begin;
select tests.assert_ready();
select plan(31);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
insert into public.students (id, tutor_id, name) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'A one'),
  ('a1000000-0000-4000-8000-000000000002', tests.tutor_a(), 'A two'),
  ('a1000000-0000-4000-8000-000000000003', tests.tutor_a(), 'A three'),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'B one');
insert into public.dues (id, tutor_id, student_id, kind, month, amount, due_date) values
  ('a2000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 120000, '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000003', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000004', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-09-01', 100000, '2026-09-05'),
  ('b2000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 90000, '2026-10-05');
insert into public.payment_claims (id, tutor_id, student_id, due_id, amount, fee_count, upi_ref) values
  ('a6000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 120000, 1, '628104739915'),
  ('a6000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 100000, 1, '111111111111'),
  ('a6000000-0000-4000-8000-000000000003', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 100000, 1, '444444444444');

-- Edits that are not a status change are refused, on a pending claim
select throws_ok($$update public.payment_claims set amount = 1 where id = 'a6000000-0000-4000-8000-000000000001'$$, 'P0001', 'claim_immutable', 'the amount of a pending claim cannot be edited');
select throws_ok($$update public.payment_claims set upi_ref = '999999999999' where id = 'a6000000-0000-4000-8000-000000000001'$$, 'P0001', 'claim_immutable', 'the reference of a pending claim cannot be edited');
select throws_ok($$update public.payment_claims set due_id = 'a2000000-0000-4000-8000-000000000004' where id = 'a6000000-0000-4000-8000-000000000001'$$, 'P0001', 'claim_immutable', 'the fee of a pending claim cannot be moved');
select throws_ok($$update public.payment_claims set created_at = now() - interval '1 day' where id = 'a6000000-0000-4000-8000-000000000001'$$, 'P0001', 'claim_immutable', 'the sent time of a pending claim cannot be edited');
select throws_ok($$update public.payment_claims set amount = amount where id = 'a6000000-0000-4000-8000-000000000001'$$, 'P0001', 'claim_immutable', 'even a no-change update of a pending claim is refused (only a status change is allowed)');
select throws_ok($$update public.payment_claims set status = 'pending' where id = 'a6000000-0000-4000-8000-000000000001'$$, 'P0001', 'claim_immutable', 'pending to pending is refused');

-- A status change cannot carry an edit of what was claimed
select throws_ok($$update public.payment_claims set status = 'rejected', handled_at = now(), amount = 1 where id = 'a6000000-0000-4000-8000-000000000001'$$, 'P0001', 'claim_immutable', 'a reject cannot edit the amount');
select throws_ok($$update public.payment_claims set status = 'rejected', handled_at = now(), upi_ref = '999999999999' where id = 'a6000000-0000-4000-8000-000000000001'$$, 'P0001', 'claim_immutable', 'a reject cannot edit the reference');
select throws_ok($$update public.payment_claims set status = 'rejected', handled_at = now(), student_id = 'a1000000-0000-4000-8000-000000000003' where id = 'a6000000-0000-4000-8000-000000000001'$$, 'P0001', 'claim_immutable', 'a reject cannot move the claim to another student');
select throws_ok($$update public.payment_claims set status = 'rejected', handled_at = now(), screenshot_path = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png' where id = 'a6000000-0000-4000-8000-000000000001'$$, 'P0001', 'claim_immutable', 'a reject cannot add a screenshot');
select is((select status || '/' || amount || '/' || upi_ref from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000001'), 'pending/120000/628104739915', 'after all those refusals the claim is unchanged');

-- The allowed moves, once
select lives_ok($$update public.payment_claims set status = 'confirmed', handled_at = now(), confirm_request_id = 'a4000000-0000-4000-8000-000000000001', confirmed_receipt_from = 1, confirmed_receipt_count = 1 where id = 'a6000000-0000-4000-8000-000000000001'$$, 'pending to confirmed is allowed');
select lives_ok($$update public.payment_claims set status = 'rejected', handled_at = now() where id = 'a6000000-0000-4000-8000-000000000002'$$, 'pending to rejected is allowed');
select throws_ok($$update public.payment_claims set status = 'rejected', handled_at = now(), confirm_request_id = null, confirmed_receipt_from = null, confirmed_receipt_count = null where id = 'a6000000-0000-4000-8000-000000000001'$$, 'P0001', 'claim_immutable', 'confirmed to rejected is refused');
select throws_ok($$update public.payment_claims set status = 'pending', handled_at = null, confirm_request_id = null, confirmed_receipt_from = null, confirmed_receipt_count = null where id = 'a6000000-0000-4000-8000-000000000001'$$, 'P0001', 'claim_immutable', 'confirmed back to pending is refused');
select throws_ok($$update public.payment_claims set status = 'confirmed', confirm_request_id = 'a4000000-0000-4000-8000-000000000002', confirmed_receipt_from = 2, confirmed_receipt_count = 1 where id = 'a6000000-0000-4000-8000-000000000002'$$, 'P0001', 'claim_immutable', 'rejected to confirmed is refused');
select throws_ok($$update public.payment_claims set status = 'pending', handled_at = null where id = 'a6000000-0000-4000-8000-000000000002'$$, 'P0001', 'claim_immutable', 'rejected back to pending is refused');
select throws_ok($$update public.payment_claims set amount = 5 where id = 'a6000000-0000-4000-8000-000000000001'$$, 'P0001', 'claim_immutable', 'the amount of a confirmed claim cannot be edited');
select throws_ok($$update public.payment_claims set handled_at = now() where id = 'a6000000-0000-4000-8000-000000000002'$$, 'P0001', 'claim_immutable', 'a rejected claim cannot be touched again');
select is((select status from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000001'), 'confirmed', 'the confirmed claim is still confirmed');
select is((select status from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000002'), 'rejected', 'the rejected claim is still rejected');

-- One pending claim per student, enforced by the database
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 100000, 1, '555555555555')$$, '23505', null, 'a second pending claim for one student is refused');
select lives_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 100000, 1, '666666666666')$$, 'a student whose claim was rejected can have a new pending claim');
select lives_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 120000, 1, '777777777777')$$, 'a student whose claim was confirmed can have a new pending claim');

-- A reference is on one live claim per tutor
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref, status, handled_at, confirm_request_id, confirmed_receipt_from, confirmed_receipt_count) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004', 100000, 1, '628104739915', 'confirmed', now(), 'a4000000-0000-4000-8000-000000000003', 2, 1)$$, '23505', null, 'the reference of a confirmed claim cannot be used again by the same tutor');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref, status, handled_at, confirm_request_id, confirmed_receipt_from, confirmed_receipt_count) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004', 100000, 1, '444444444444', 'confirmed', now(), 'a4000000-0000-4000-8000-000000000003', 2, 1)$$, '23505', null, 'the reference of a pending claim cannot be used again by the same tutor');
select lives_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 90000, 1, '628104739915')$$, 'another tutor can hold the same reference');
select lives_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref, status, handled_at) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004', 100000, 1, '111111111111', 'rejected', now())$$, 'the reference of a rejected claim is free again');

-- A confirm request id is on one claim per tutor
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref, status, handled_at, confirm_request_id, confirmed_receipt_from, confirmed_receipt_count) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004', 100000, 1, '888888888888', 'confirmed', now(), 'a4000000-0000-4000-8000-000000000001', 2, 1)$$, '23505', null, 'one confirm request id cannot confirm two claims');

select ok(not has_function_privilege('anon', 'public.payment_claims_guard()', 'execute') and not has_function_privilege('authenticated', 'public.payment_claims_guard()', 'execute'), 'neither anon nor authenticated can execute payment_claims_guard');
select is((select count(*) from pg_trigger where tgrelid = 'public.payment_claims'::regclass and tgname = 'payment_claims_guard' and not tgisinternal)::int, 1, 'the guard trigger is on the table');

select * from finish();
rollback;
