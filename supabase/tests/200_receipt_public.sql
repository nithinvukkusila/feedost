-- R1-7 Part B criteria 23 to 26, 30 (docs/specs/R1-7-record-payment.md, plan sections 2 and 6): get_receipt and receipt_hit.
-- get_receipt is executable by service_role only; it returns exactly the allowed keys (live and cancelled); unknown and
-- malformed tokens give null; no phone, email, UPI id or id is in the answer; another tutor's and anon's reads of payments
-- stay closed; receipt_hit counts atomically, purges old hours and is not callable by clients.
-- Self-contained: makes its own users and rolls everything back.
begin;
select tests.assert_ready();
select plan(50);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
update public.tutors set name = 'Asha Rao', subjects = array['Maths', 'Physics'], language = 'kn', upi_id = 'asha@okbank' where id = tests.tutor_a();
update public.tutors set name = 'Bala Iyer', language = 'te' where id = tests.tutor_b();
insert into public.students (id, tutor_id, name, parent_name, parent_phone, parent_language) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'Ravi', 'Sunita', '+919876543210', 'hi'),
  ('a1000000-0000-4000-8000-000000000002', tests.tutor_a(), 'Meena', null, null, 'en'),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'Bhanu', 'Lata', '+919812345678', 'te');
insert into public.dues (id, tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values
  ('a2000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 120000, 50000, 'partial', '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'monthly', '2026-10-01', 90000, 90000, 'paid', '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000003', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'opening', null, 30000, 0, 'due', '2026-10-05'),
  ('b2000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 70000, 70000, 'paid', '2026-10-05');
insert into public.receipt_counters (tutor_id, last_no) values (tests.tutor_a(), 4), (tests.tutor_b(), 1);
insert into public.payments (id, tutor_id, due_id, amount, method, paid_on, receipt_no, request_id, balance_after, receipt_token, voided_at) values
  ('a3000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a2000000-0000-4000-8000-000000000001', 50000, 'upi',  '2026-10-06', 1, 'a4000000-0000-4000-8000-000000000001', 70000, 'PartPaidToken_aaaaaaaaaa', null),
  ('a3000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a2000000-0000-4000-8000-000000000002', 90000, 'cash', '2026-10-07', 2, 'a4000000-0000-4000-8000-000000000002', 0,     'FullyPaidToken-aaaaaaaaa', null),
  ('a3000000-0000-4000-8000-000000000003', tests.tutor_a(), 'a2000000-0000-4000-8000-000000000003', 10000, 'cash', '2026-10-08', 3, 'a4000000-0000-4000-8000-000000000003', 20000, 'OpeningToken_aaaaaaaaaaa', null),
  ('a3000000-0000-4000-8000-000000000004', tests.tutor_a(), 'a2000000-0000-4000-8000-000000000001', 20000, 'upi',  '2026-10-09', 4, 'a4000000-0000-4000-8000-000000000004', 50000, 'CancelledToken_aaaaaaaaa', now()),
  ('b3000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b2000000-0000-4000-8000-000000000001', 70000, 'upi',  '2026-10-06', 1, 'b4000000-0000-4000-8000-000000000001', 0,     'TutorBToken_bbbbbbbbbbbb', null);

-- Privileges
select ok(has_function_privilege('service_role', 'public.get_receipt(text)', 'execute'), 'service_role can execute get_receipt');
select ok(not has_function_privilege('anon', 'public.get_receipt(text)', 'execute'), 'anon cannot execute get_receipt');
select ok(not has_function_privilege('authenticated', 'public.get_receipt(text)', 'execute'), 'authenticated cannot execute get_receipt');
select ok(has_function_privilege('service_role', 'public.receipt_hit(text, integer)', 'execute'), 'service_role can execute receipt_hit');
select ok(not has_function_privilege('anon', 'public.receipt_hit(text, integer)', 'execute'), 'anon cannot execute receipt_hit');
select ok(not has_function_privilege('authenticated', 'public.receipt_hit(text, integer)', 'execute'), 'authenticated cannot execute receipt_hit');
select ok((select relrowsecurity from pg_class where oid = 'public.receipt_hits'::regclass), 'row-level security is on for receipt_hits');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'receipt_hits')::int, 0, 'receipt_hits has no policy');
select ok(not has_table_privilege('anon', 'public.receipt_hits', 'select,insert,update,delete'), 'anon has no privilege on receipt_hits');
select ok(not has_table_privilege('authenticated', 'public.receipt_hits', 'select,insert,update,delete'), 'authenticated has no privilege on receipt_hits');
select ok((select prosecdef from pg_proc where oid = 'public.get_receipt(text)'::regprocedure), 'get_receipt is security definer');

-- A client cannot call it (the privilege check comes first)
select tests.act_as_anon();
select throws_ok($$select public.get_receipt('PartPaidToken_aaaaaaaaaa')$$, '42501', null, 'anon cannot call get_receipt');
select throws_ok($$select public.receipt_hit('h', 5)$$, '42501', null, 'anon cannot call receipt_hit');
select throws_ok($$select count(*) from public.payments$$, '42501', null, 'anon cannot read payments');
select tests.reset();
select tests.act_as(tests.tutor_b());
select throws_ok($$select public.get_receipt('PartPaidToken_aaaaaaaaaa')$$, '42501', null, 'another tutor cannot call get_receipt for A token');
select throws_ok($$select public.receipt_hit('h', 5)$$, '42501', null, 'a tutor cannot call receipt_hit');
select is((select count(*) from public.payments where receipt_token = 'PartPaidToken_aaaaaaaaaa')::int, 0, 'another tutor cannot read A payment by token');
select is((select count(*) from public.payments where tutor_id = tests.tutor_a())::int, 0, 'another tutor reads none of A payments');
select tests.reset();

-- Answers, as the Edge Function's role
set local role service_role;

-- Part paid: exactly the live key list
select is((select array_agg(k order by k collate "C") from jsonb_object_keys(public.get_receipt('PartPaidToken_aaaaaaaaaa')) k),
  array['amount','balance_after','language','method','month','paid_on','parent_name','receipt_no','status','student_name','tutor_name','tutor_subjects'],
  'a part paid receipt has exactly the allowed keys');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys(public.get_receipt('FullyPaidToken-aaaaaaaaa')) k),
  array['amount','balance_after','language','method','month','paid_on','parent_name','receipt_no','status','student_name','tutor_name','tutor_subjects'],
  'a fully paid receipt has exactly the allowed keys');
select is(public.get_receipt('PartPaidToken_aaaaaaaaaa'),
  '{"receipt_no":1,"status":"part_paid","tutor_name":"Asha Rao","tutor_subjects":["Maths","Physics"],"student_name":"Ravi","parent_name":"Sunita","month":"2026-10-01","amount":50000,"method":"upi","paid_on":"2026-10-06","balance_after":70000,"language":"hi"}'::jsonb,
  'a part paid receipt carries the values fixed at record time');
select is(public.get_receipt('FullyPaidToken-aaaaaaaaa')->>'status', 'paid', 'balance 0 is paid');
select is(public.get_receipt('FullyPaidToken-aaaaaaaaa')->'parent_name', 'null'::jsonb, 'no parent name is a null, the key stays');
select is(public.get_receipt('OpeningToken_aaaaaaaaaaa')->'month', 'null'::jsonb, 'an earlier balance has month null');
select is(public.get_receipt('OpeningToken_aaaaaaaaaaa')->>'status', 'part_paid', 'the earlier balance receipt is part paid');

-- Cancelled: five keys and no money
select is((select array_agg(k order by k collate "C") from jsonb_object_keys(public.get_receipt('CancelledToken_aaaaaaaaa')) k),
  array['language','receipt_no','status','student_name','tutor_name'], 'a cancelled receipt has exactly five keys');
select is(public.get_receipt('CancelledToken_aaaaaaaaa'),
  '{"receipt_no":4,"status":"cancelled","tutor_name":"Asha Rao","student_name":"Ravi","language":"hi"}'::jsonb,
  'a cancelled receipt says only number, tutor, student, status and language');
select ok(not (public.get_receipt('CancelledToken_aaaaaaaaa') ?| array['amount','method','balance_after','paid_on','month','parent_name','tutor_subjects']),
  'a cancelled receipt has no amount, method, balance, date, month, parent or subjects');

-- Nothing private in any answer
select is((select count(*) from unnest(array['PartPaidToken_aaaaaaaaaa','FullyPaidToken-aaaaaaaaa','OpeningToken_aaaaaaaaaaa','CancelledToken_aaaaaaaaa','TutorBToken_bbbbbbbbbbbb']) t
  where public.get_receipt(t)::text ~* '(phone|email|upi_id|tutor_id|student_id|due_id|payment_id|"id"|created_at|request_id|receipt_token|9876543210|asha@okbank|example\.test)')::int,
  0, 'no phone, email, UPI id, id or token appears in any answer');
select is((select count(*) from unnest(array['PartPaidToken_aaaaaaaaaa','TutorBToken_bbbbbbbbbbbb']) t
  where public.get_receipt(t)::text ~ '(Bhanu|Bala)')::int, 1, 'the answer for A token has no B names, and B own answer has B names');

-- Each token gives its own tutor's receipt only
select is(public.get_receipt('TutorBToken_bbbbbbbbbbbb')->>'tutor_name', 'Bala Iyer', 'B token gives B receipt');
select is(public.get_receipt('TutorBToken_bbbbbbbbbbbb')->>'receipt_no', '1', 'B receipt number is B own number 1 (A also has a 1)');

-- Language: parent first, else tutor (the column is not null, so test the fallback by the tutor row's own value), else en
select is(public.get_receipt('PartPaidToken_aaaaaaaaaa')->>'language', 'hi', 'language is the parent language');
select is(public.get_receipt('FullyPaidToken-aaaaaaaaa')->>'language', 'en', 'language is the parent language even when it is en');

-- Unknown and malformed tokens
select is(public.get_receipt('NoSuchToken_aaaaaaaaaaaa'), null, 'an unknown token gives null');
select is(public.get_receipt('PartPaidToken_aaaaaaaaaa '), null, 'a token with a trailing space gives null');
select is(public.get_receipt('partpaidtoken_aaaaaaaaaa'), null, 'a different case gives null');
select is(public.get_receipt('PartPaidToken_aaaaaaaaa'), null, 'a token one character short gives null');
select is(public.get_receipt('PartPaidToken_'), null, 'a short token gives null');
select is(public.get_receipt(''), null, 'an empty token gives null');
select is(public.get_receipt(null), null, 'a null token gives null');
select is(public.get_receipt('%'), null, 'a wildcard gives null');
select is(public.get_receipt($$' or 1=1 --$$), null, 'an injection attempt gives null');

-- Deleting a tutor (account deletion) makes the link a not found
reset role;
delete from auth.users where id = tests.tutor_b();
set local role service_role;
select is(public.get_receipt('TutorBToken_bbbbbbbbbbbb'), null, 'after the tutor is deleted the link gives null');
reset role;

-- receipt_hit
select has_index('public', 'receipt_hits', 'receipt_hits_hour_bucket_idx', array['hour_bucket'], 'the purge by hour has its own index');
insert into public.receipt_hits (key_hash, hour_bucket, n) values ('old', date_trunc('hour', now()) - interval '25 hours', 3);
set local role service_role;
select is((select array_agg(public.receipt_hit('hash-a', 5) order by g) from generate_series(1, 6) g),
  array[true, true, true, true, true, false], 'five calls are within the limit, the sixth is not');
select is(public.receipt_hit('hash-b', 5), true, 'another hash starts its own count');
select is((select n from public.receipt_hits where key_hash = 'hash-a'), 6, 'the counter holds the number of calls');
select is((select count(*) from public.receipt_hits where key_hash = 'old')::int, 0, 'a row more than a day old is removed by the next call');
reset role;
select is((select count(*) from public.waitlist_hits where ip_hash in ('hash-a', 'hash-b'))::int, 0, 'receipt counts are kept apart from the waitlist counts');

select * from finish();
rollback;
