-- R1-9 Part A criteria 3 to 11 (docs/specs/R1-9-parent-pay-page.md, plan sections A3 and A5): get_pay_page, record_consent,
-- paypage_hit and current_notice_version. The functions are executable by service_role only; the answer has a fixed key list
-- in each state (before and after consent); no phone, name, email, pay token, id or other student's data is in any answer;
-- unknown, malformed and archived tokens all give null (or not_found); record_consent is idempotent and checks the token
-- before the version; paypage_hit counts atomically and purges old hours.
-- Self-contained: makes its own users and rolls everything back. Answers are read as the test runner, which owns the
-- security definer functions; the privilege checks use service_role, anon and the tutors.
begin;
select tests.assert_ready();
select plan(108);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
update public.tutors set name = 'Asha Rao', subjects = array['Maths', 'Physics'], language = 'kn', upi_id = 'asha@okbank' where id = tests.tutor_a();
update public.tutors set name = 'Bala Iyer', language = 'te', upi_id = 'bala@okbank' where id = tests.tutor_b();

insert into public.students (id, tutor_id, name, parent_name, parent_phone, parent_language, active, pay_token) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'Ravi',   'Sunita', '+919876543210', 'hi', true,  'PayRaviToken_aaaaaaaaaa'),
  ('a1000000-0000-4000-8000-000000000002', tests.tutor_a(), 'Meena',  'Sunita', '+919876543210', 'en', true,  'PayMeenaToken_aaaaaaaaaa'),
  ('a1000000-0000-4000-8000-000000000003', tests.tutor_a(), 'Oldie',  null,     null,            'en', false, 'PayOldToken_aaaaaaaaaaaa'),
  ('a1000000-0000-4000-8000-000000000004', tests.tutor_a(), 'Many',   null,     null,            'en', true,  'PayManyToken_aaaaaaaaaaa'),
  ('a1000000-0000-4000-8000-000000000005', tests.tutor_a(), 'Rcpts',  null,     null,            'en', true,  'PayRcptToken_aaaaaaaaaaa'),
  ('a1000000-0000-4000-8000-000000000006', tests.tutor_a(), 'Nothing', null,    null,            'en', true,  'PayNoneToken_aaaaaaaaaaa'),
  ('a1000000-0000-4000-8000-000000000007', tests.tutor_a(), 'Fresh',  null,     null,            'en', true,  'PayFreshToken_aaaaaaaaaa'),
  ('a1000000-0000-4000-8000-000000000008', tests.tutor_a(), 'Settled', null,    null,            'en', true,  'PayPaidToken_aaaaaaaaaaa'),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'Bhanu',  'Lata',   '+919812345678', 'te', true,  'PayBhanuToken_bbbbbbbbb');

insert into public.dues (id, tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values
  -- Ravi: one part paid, one earlier balance part paid, one fully paid
  ('a2000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 120000, 50000, 'partial', '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-09-01', 90000, 90000, 'paid', '2026-09-05'),
  ('a2000000-0000-4000-8000-000000000003', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'opening', null, 30000, 10000, 'partial', '2026-10-05'),
  -- Meena (a sibling with the same parent phone): fully paid
  ('a2000000-0000-4000-8000-000000000004', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'monthly', '2026-10-01', 80000, 80000, 'paid', '2026-10-05'),
  -- Fresh: an amount nobody else has, to prove it never appears before consent
  ('a2000000-0000-4000-8000-000000000005', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000007', 'monthly', '2026-10-01', 777700, 0, 'due', '2026-10-05'),
  -- Settled: fully paid
  ('a2000000-0000-4000-8000-000000000006', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000008', 'monthly', '2026-10-01', 60000, 60000, 'paid', '2026-10-05'),
  ('b2000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 70000, 0, 'due', '2026-10-05');

-- Many: 26 open monthly dues
insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date)
select tests.tutor_a(), 'a1000000-0000-4000-8000-000000000004', 'monthly', (date '2024-01-01' + g * interval '1 month')::date, 1000, 0, 'due',
       (date '2024-01-05' + g * interval '1 month')::date
  from generate_series(0, 25) g;

-- Rcpts: 13 fully paid monthly dues, each with one receipt
insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date)
select tests.tutor_a(), 'a1000000-0000-4000-8000-000000000005', 'monthly', (date '2025-08-01' + g * interval '1 month')::date, 10000, 10000, 'paid',
       (date '2025-08-05' + g * interval '1 month')::date
  from generate_series(1, 13) g;

insert into public.receipt_counters (tutor_id, last_no) values (tests.tutor_a(), 200), (tests.tutor_b(), 1);
insert into public.payments (id, tutor_id, due_id, amount, method, paid_on, receipt_no, request_id, balance_after, receipt_token, created_at, voided_at) values
  ('a3000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a2000000-0000-4000-8000-000000000001', 50000, 'upi',  '2026-10-06', 1, 'a4000000-0000-4000-8000-000000000001', 70000, 'RcptS1Oct_aaaaaaaaaaaaaa', '2026-10-06 10:00+00', null),
  ('a3000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a2000000-0000-4000-8000-000000000002', 90000, 'cash', '2026-10-07', 2, 'a4000000-0000-4000-8000-000000000002', 0,     'RcptS1Sep_aaaaaaaaaaaaaa', '2026-10-07 10:00+00', null),
  ('a3000000-0000-4000-8000-000000000003', tests.tutor_a(), 'a2000000-0000-4000-8000-000000000003', 10000, 'cash', '2026-10-08', 3, 'a4000000-0000-4000-8000-000000000003', 20000, 'RcptS1Opn_aaaaaaaaaaaaaa', '2026-10-08 10:00+00', null),
  ('a3000000-0000-4000-8000-000000000004', tests.tutor_a(), 'a2000000-0000-4000-8000-000000000001', 20000, 'upi',  '2026-10-09', 4, 'a4000000-0000-4000-8000-000000000004', 50000, 'RcptS1Void_aaaaaaaaaaaaa', '2026-10-09 10:00+00', '2026-10-09 11:00+00'),
  ('a3000000-0000-4000-8000-000000000005', tests.tutor_a(), 'a2000000-0000-4000-8000-000000000004', 80000, 'upi',  '2026-10-06', 5, 'a4000000-0000-4000-8000-000000000005', 0,     'RcptS2Oct_aaaaaaaaaaaaaa', '2026-10-06 12:00+00', null),
  ('a3000000-0000-4000-8000-000000000006', tests.tutor_a(), 'a2000000-0000-4000-8000-000000000006', 60000, 'cash', '2026-10-06', 6, 'a4000000-0000-4000-8000-000000000006', 0,     'RcptS8Oct_aaaaaaaaaaaaaa', '2026-10-06 13:00+00', null),
  ('b3000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b2000000-0000-4000-8000-000000000001', 70000, 'upi',  '2026-10-06', 1, 'b4000000-0000-4000-8000-000000000001', 0,     'RcptBhanu_bbbbbbbbbbbbbb', '2026-10-06 14:00+00', null);
insert into public.payments (tutor_id, due_id, amount, method, paid_on, receipt_no, request_id, balance_after, receipt_token, created_at)
select d.tutor_id, d.id, 10000, 'cash', '2026-01-02', 100 + d.n, gen_random_uuid(), 0,
       'RcptS5N' || lpad(d.n::text, 2, '0') || '_aaaaaaaaaaaaaaaa', timestamptz '2026-01-01 00:00+00' + d.n * interval '1 day'
  from (select d0.tutor_id, d0.id, row_number() over (order by d0.month)::int n from public.dues d0 where d0.student_id = 'a1000000-0000-4000-8000-000000000005') d;

-- Already agreed: Many, Rcpts, Nothing, Settled. Fresh agreed only to an old notice. Ravi, Meena and Oldie have not agreed.
insert into public.consents (tutor_id, student_id, notice_version) values
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000004', 'v1'),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000005', 'v1'),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000006', 'v1'),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000008', 'v1'),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000007', 'v0'),
  (tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'v1');

-- Privileges
select ok(has_function_privilege('service_role', 'public.get_pay_page(text)', 'execute'), 'service_role can execute get_pay_page');
select ok(has_function_privilege('service_role', 'public.record_consent(text, text)', 'execute'), 'service_role can execute record_consent');
select ok(has_function_privilege('service_role', 'public.paypage_hit(text, integer)', 'execute'), 'service_role can execute paypage_hit');
select ok(has_function_privilege('service_role', 'public.current_notice_version()', 'execute'), 'service_role can execute current_notice_version');
select ok(not has_function_privilege('anon', 'public.get_pay_page(text)', 'execute'), 'anon cannot execute get_pay_page');
select ok(not has_function_privilege('anon', 'public.record_consent(text, text)', 'execute'), 'anon cannot execute record_consent');
select ok(not has_function_privilege('anon', 'public.paypage_hit(text, integer)', 'execute'), 'anon cannot execute paypage_hit');
select ok(not has_function_privilege('anon', 'public.current_notice_version()', 'execute'), 'anon cannot execute current_notice_version');
select ok(not has_function_privilege('authenticated', 'public.get_pay_page(text)', 'execute'), 'authenticated cannot execute get_pay_page');
select ok(not has_function_privilege('authenticated', 'public.record_consent(text, text)', 'execute'), 'authenticated cannot execute record_consent');
select ok(not has_function_privilege('authenticated', 'public.paypage_hit(text, integer)', 'execute'), 'authenticated cannot execute paypage_hit');
select ok(not has_function_privilege('authenticated', 'public.current_notice_version()', 'execute'), 'authenticated cannot execute current_notice_version');
select ok((select prosecdef from pg_proc where oid = 'public.get_pay_page(text)'::regprocedure), 'get_pay_page is security definer');
select ok((select prosecdef from pg_proc where oid = 'public.record_consent(text, text)'::regprocedure), 'record_consent is security definer');
select ok(not (select prosecdef from pg_proc where oid = 'public.paypage_hit(text, integer)'::regprocedure), 'paypage_hit is security invoker');
select ok((select relrowsecurity from pg_class where oid = 'public.paypage_hits'::regclass), 'row-level security is on for paypage_hits');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'paypage_hits')::int, 0, 'paypage_hits has no policy');
select ok(not has_table_privilege('anon', 'public.paypage_hits', 'select,insert,update,delete'), 'anon has no privilege on paypage_hits');
select ok(not has_table_privilege('authenticated', 'public.paypage_hits', 'select,insert,update,delete'), 'authenticated has no privilege on paypage_hits');
select is((select array_agg(column_name::text order by column_name::text collate "C") from information_schema.columns where table_schema = 'public' and table_name = 'paypage_hits'),
  array['hour_bucket','key_hash','n'], 'paypage_hits holds only a hash, an hour and a count (no tutor_id, no raw value)');

-- A client cannot call them (the privilege check comes first)
select tests.act_as_anon();
select throws_ok($$select public.get_pay_page('PayRaviToken_aaaaaaaaaa')$$, '42501', null, 'anon cannot call get_pay_page');
select throws_ok($$select public.record_consent('PayRaviToken_aaaaaaaaaa', 'v1')$$, '42501', null, 'anon cannot call record_consent');
select throws_ok($$select public.paypage_hit('h', 5)$$, '42501', null, 'anon cannot call paypage_hit');
select throws_ok($$select public.current_notice_version()$$, '42501', null, 'anon cannot call current_notice_version');
select tests.reset();
select tests.act_as(tests.tutor_a());
select throws_ok($$select public.get_pay_page('PayRaviToken_aaaaaaaaaa')$$, '42501', null, 'a tutor cannot call get_pay_page, not even for own student');
select throws_ok($$select public.record_consent('PayRaviToken_aaaaaaaaaa', 'v1')$$, '42501', null, 'a tutor cannot call record_consent, not even for own student');
select tests.reset();
select tests.act_as(tests.tutor_b());
select throws_ok($$select public.get_pay_page('PayRaviToken_aaaaaaaaaa')$$, '42501', null, 'another tutor cannot call get_pay_page for A token');
select throws_ok($$select public.record_consent('PayRaviToken_aaaaaaaaaa', 'v1')$$, '42501', null, 'another tutor cannot call record_consent for A token');
select throws_ok($$select public.paypage_hit('h', 5)$$, '42501', null, 'a tutor cannot call paypage_hit');
select tests.reset();

-- The notice version is one value that satisfies the consents check
set local role service_role;
select ok(public.current_notice_version() ~ '^[a-z0-9._-]{1,16}$', 'the current notice version fits the consents check');
select ok(public.get_pay_page('PayRaviToken_aaaaaaaaaa') is not null, 'service_role can read a page');
reset role;

-- Unknown, malformed and archived tokens: null and not_found, nothing written
select is(public.get_pay_page('NoSuchToken_aaaaaaaaaaaa'), null, 'an unknown token gives null');
select is(public.get_pay_page('PayRaviToken_aaaaaaaaaa '), null, 'a token with a trailing space gives null');
select is(public.get_pay_page('payravitoken_aaaaaaaaaa'), null, 'a different case gives null');
select is(public.get_pay_page('PayRaviToken_aaaaaaaaa'), null, 'a token one character short gives null');
select is(public.get_pay_page('PayRaviToken_'), null, 'a short token gives null');
select is(public.get_pay_page(''), null, 'an empty token gives null');
select is(public.get_pay_page(null), null, 'a null token gives null');
select is(public.get_pay_page('%'), null, 'a wildcard gives null');
select is(public.get_pay_page($$' or 1=1 --$$), null, 'an injection attempt gives null');
select is(public.get_pay_page('PayOldToken_aaaaaaaaaaaa'), null, 'an archived student gives null');
select is(public.record_consent('NoSuchToken_aaaaaaaaaaaa', 'v1'), 'not_found', 'record_consent: an unknown token is not_found');
select is(public.record_consent('payravitoken_aaaaaaaaaa', 'v1'), 'not_found', 'record_consent: a different case is not_found');
select is(public.record_consent('', 'v1'), 'not_found', 'record_consent: an empty token is not_found');
select is(public.record_consent(null, 'v1'), 'not_found', 'record_consent: a null token is not_found');
select is(public.record_consent('%', 'v1'), 'not_found', 'record_consent: a wildcard is not_found');
select is(public.record_consent('PayOldToken_aaaaaaaaaaaa', 'v1'), 'not_found', 'record_consent: an archived student is not_found');
select is(public.record_consent('NoSuchToken_aaaaaaaaaaaa', 'stale'), 'not_found', 'an unknown token with a stale version is not_found (the version is not revealed)');
select is((select count(*) from public.consents where student_id = 'a1000000-0000-4000-8000-000000000003')::int, 0, 'nothing was written for the archived student');
select is((select count(*) from public.consents)::int, 6, 'nothing was written by any of the failed calls (still the six fixture rows)');

-- Before consent: exactly six keys, and no money anywhere
select is((select array_agg(k order by k collate "C") from jsonb_object_keys(public.get_pay_page('PayRaviToken_aaaaaaaaaa')) k),
  array['consent_needed','language','notice_version','student_name','tutor_name','tutor_subjects'], 'before consent the answer has exactly the six notice keys');
select is(public.get_pay_page('PayRaviToken_aaaaaaaaaa'),
  '{"consent_needed":true,"notice_version":"v1","tutor_name":"Asha Rao","tutor_subjects":["Maths","Physics"],"student_name":"Ravi","language":"hi"}'::jsonb,
  'before consent the values are the notice header only');
select is(public.get_pay_page('PayFreshToken_aaaaaaaaaa')->'consent_needed', 'true'::jsonb, 'a consent to an old notice version does not count');
select ok(public.get_pay_page('PayFreshToken_aaaaaaaaaa')::text !~ '(777700|asha@okbank|upi|amount|remaining|receipt)', 'no amount, UPI id or receipt appears before consent');
select is(public.get_pay_page('PayFreshToken_aaaaaaaaaa')->'language', '"en"'::jsonb, 'language is the parent language');

-- record_consent: stale versions write nothing
select is(public.record_consent('PayMeenaToken_aaaaaaaaaa', 'stale'), 'stale_notice', 'another version is stale_notice');
select is(public.record_consent('PayMeenaToken_aaaaaaaaaa', 'v0'), 'stale_notice', 'an old version is stale_notice');
select is(public.record_consent('PayMeenaToken_aaaaaaaaaa', ''), 'stale_notice', 'an empty version is stale_notice');
select is(public.record_consent('PayMeenaToken_aaaaaaaaaa', null), 'stale_notice', 'a null version is stale_notice');
select is((select count(*) from public.consents where student_id = 'a1000000-0000-4000-8000-000000000002')::int, 0, 'no stale call wrote a row');

-- record_consent: ok twice, one row, tutor from the student
select is(public.record_consent('PayMeenaToken_aaaaaaaaaa', 'v1'), 'ok', 'the current version is ok');
select is(public.record_consent('PayMeenaToken_aaaaaaaaaa', 'v1'), 'ok', 'a second call is ok too');
select is((select count(*) from public.consents where student_id = 'a1000000-0000-4000-8000-000000000002')::int, 1, 'still one row');
select is((select tutor_id from public.consents where student_id = 'a1000000-0000-4000-8000-000000000002'), tests.tutor_a(), 'the row names the student tutor');
select is((select notice_version from public.consents where student_id = 'a1000000-0000-4000-8000-000000000002'), 'v1', 'the row holds the version');
select is(public.get_pay_page('PayRaviToken_aaaaaaaaaa')->'consent_needed', 'true'::jsonb, 'a sibling consent does not count for Ravi');

-- After consent (Ravi): exactly 13 keys and fixed element keys
select is(public.record_consent('PayRaviToken_aaaaaaaaaa', 'v1'), 'ok', 'Ravi parent agrees');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys(public.get_pay_page('PayRaviToken_aaaaaaaaaa')) k),
  array['consent_needed','language','notice_version','open_dues','open_dues_more','receipts','receipts_more','student_name','today','total_remaining','tutor_name','tutor_subjects','upi_id'],
  'after consent the answer has exactly the thirteen keys');
select is((select array_agg(k order by k collate "C") from (select distinct k from jsonb_array_elements(public.get_pay_page('PayRaviToken_aaaaaaaaaa')->'open_dues') e, jsonb_object_keys(e) k) q),
  array['amount','amount_paid','due_date','kind','month','remaining'], 'each open due has exactly six keys');
select is((select array_agg(k order by k collate "C") from (select distinct k from jsonb_array_elements(public.get_pay_page('PayRaviToken_aaaaaaaaaa')->'receipts') e, jsonb_object_keys(e) k) q),
  array['amount','balance_after','month','paid_on','receipt_no','receipt_token'], 'each receipt has exactly six keys');
select is(public.get_pay_page('PayRaviToken_aaaaaaaaaa')->'consent_needed', 'false'::jsonb, 'consent_needed is false after agreeing');
select is(public.get_pay_page('PayRaviToken_aaaaaaaaaa')->>'today', to_char(public.india_day(now()), 'YYYY-MM-DD'), 'today is the India day');
select is(public.get_pay_page('PayRaviToken_aaaaaaaaaa')->>'upi_id', 'asha@okbank', 'the UPI id is the tutor one');
select is(public.get_pay_page('PayRaviToken_aaaaaaaaaa')->'open_dues',
  '[{"kind":"opening","month":null,"due_date":"2026-10-05","amount":30000,"amount_paid":10000,"remaining":20000},
    {"kind":"monthly","month":"2026-10-01","due_date":"2026-10-05","amount":120000,"amount_paid":50000,"remaining":70000}]'::jsonb,
  'the earlier balance is first, a part paid fee shows what remains, a paid fee is absent');
select is(public.get_pay_page('PayRaviToken_aaaaaaaaaa')->'total_remaining', '90000'::jsonb, 'the total is the sum of what remains');
select is(public.get_pay_page('PayRaviToken_aaaaaaaaaa')->'open_dues_more', '0'::jsonb, 'no more than shown');
select is(public.get_pay_page('PayRaviToken_aaaaaaaaaa')->'receipts',
  '[{"receipt_no":3,"receipt_token":"RcptS1Opn_aaaaaaaaaaaaaa","month":null,"amount":10000,"paid_on":"2026-10-08","balance_after":20000},
    {"receipt_no":2,"receipt_token":"RcptS1Sep_aaaaaaaaaaaaaa","month":"2026-09-01","amount":90000,"paid_on":"2026-10-07","balance_after":0},
    {"receipt_no":1,"receipt_token":"RcptS1Oct_aaaaaaaaaaaaaa","month":"2026-10-01","amount":50000,"paid_on":"2026-10-06","balance_after":70000}]'::jsonb,
  'receipts are newest first, the cancelled one and the sibling one are absent, the earlier balance has month null');
select is(public.get_pay_page('PayRaviToken_aaaaaaaaaa')->'receipts_more', 'false'::jsonb, 'receipts_more is false with three');
select is(public.get_pay_page('PayMeenaToken_aaaaaaaaaa')->'receipts', '[{"receipt_no":5,"receipt_token":"RcptS2Oct_aaaaaaaaaaaaaa","month":"2026-10-01","amount":80000,"paid_on":"2026-10-06","balance_after":0}]'::jsonb, 'the sibling sees only her own receipt');
select is(public.get_pay_page('PayMeenaToken_aaaaaaaaaa')->'open_dues', '[]'::jsonb, 'a fully paid student has an empty list');
select is(public.get_pay_page('PayMeenaToken_aaaaaaaaaa')->'total_remaining', '0'::jsonb, 'and a total of 0');
select is(public.get_pay_page('PayPaidToken_aaaaaaaaaaa')->'total_remaining', '0'::jsonb, 'Settled owes 0');
select is(public.get_pay_page('PayNoneToken_aaaaaaaaaaa')->'open_dues', '[]'::jsonb, 'a student never charged has an empty list');
select is(public.get_pay_page('PayNoneToken_aaaaaaaaaaa')->'receipts', '[]'::jsonb, 'and no receipts (an empty list, not null)');
select is(public.get_pay_page('PayNoneToken_aaaaaaaaaaa')->'receipts_more', 'false'::jsonb, 'and receipts_more is false');

-- More than 24 open dues
select is(jsonb_array_length(public.get_pay_page('PayManyToken_aaaaaaaaaaa')->'open_dues'), 24, 'at most 24 open dues are listed');
select is(public.get_pay_page('PayManyToken_aaaaaaaaaaa')->'open_dues_more', '2'::jsonb, 'two more are counted');
select is(public.get_pay_page('PayManyToken_aaaaaaaaaaa')->'total_remaining', '26000'::jsonb, 'the total counts all 26');
select is(public.get_pay_page('PayManyToken_aaaaaaaaaaa')#>>'{open_dues,0,month}', '2024-01-01', 'the oldest is first');
select is(public.get_pay_page('PayManyToken_aaaaaaaaaaa')#>>'{open_dues,23,month}', '2025-12-01', 'the 24th is the last listed');

-- More than 12 receipts
select is(jsonb_array_length(public.get_pay_page('PayRcptToken_aaaaaaaaaaa')->'receipts'), 12, 'at most 12 receipts are listed');
select is(public.get_pay_page('PayRcptToken_aaaaaaaaaaa')->'receipts_more', 'true'::jsonb, 'with 13, receipts_more is true');
select is(public.get_pay_page('PayRcptToken_aaaaaaaaaaa')#>>'{receipts,0,receipt_no}', '113', 'the newest is first');
update public.payments set voided_at = now() where tutor_id = tests.tutor_a() and receipt_no = 101;
select is(jsonb_array_length(public.get_pay_page('PayRcptToken_aaaaaaaaaaa')->'receipts'), 12, 'with one cancelled there are exactly 12');
select is(public.get_pay_page('PayRcptToken_aaaaaaaaaaa')->'receipts_more', 'false'::jsonb, 'with exactly 12, receipts_more is false');
select is(public.get_pay_page('PayRcptToken_aaaaaaaaaaa')#>>'{receipts,11,receipt_no}', '102', 'the cancelled one is not listed');

-- Nothing private in any answer, before or after consent
select is((select count(*) from unnest(array['PayRaviToken_aaaaaaaaaa','PayMeenaToken_aaaaaaaaaa','PayManyToken_aaaaaaaaaaa','PayRcptToken_aaaaaaaaaaa','PayNoneToken_aaaaaaaaaaa','PayFreshToken_aaaaaaaaaa','PayPaidToken_aaaaaaaaaaa','PayBhanuToken_bbbbbbbbb']) t
  where public.get_pay_page(t)::text ~* '(phone|email|tutor_id|student_id|due_id|payment_id|"id"|created_at|claim|reminder|plan|pay_token|parent|9876543210|9812345678|Sunita|Lata|example\.test|Pay[A-Za-z]+Token_)')::int,
  0, 'no phone, parent, email, pay token, id name or claim, reminder or plan word appears in any answer');
select is((select count(*) from unnest(array['PayRaviToken_aaaaaaaaaa','PayMeenaToken_aaaaaaaaaa','PayManyToken_aaaaaaaaaaa','PayRcptToken_aaaaaaaaaaa','PayNoneToken_aaaaaaaaaaa','PayFreshToken_aaaaaaaaaa','PayPaidToken_aaaaaaaaaaa','PayBhanuToken_bbbbbbbbb']) t
  where public.get_pay_page(t)::text ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')::int,
  0, 'no identifier of any kind (UUID shape) appears in any answer');
select ok(public.get_pay_page('PayRaviToken_aaaaaaaaaa')::text !~ '(Meena|Bhanu|Bala|bala@okbank|Fresh|RcptS2|RcptBhanu)', 'Ravi page has no other student, no other tutor and no other receipt');
select ok(public.get_pay_page('PayBhanuToken_bbbbbbbbb')::text !~ '(Ravi|Meena|Asha|asha@okbank)', 'the other tutor page has nothing of tutor A');

-- Deleting a tutor (account deletion) makes the link a not found
delete from auth.users where id = tests.tutor_b();
select is(public.get_pay_page('PayBhanuToken_bbbbbbbbb'), null, 'after the tutor is deleted the link gives null');
select is(public.record_consent('PayBhanuToken_bbbbbbbbb', 'v1'), 'not_found', 'and record_consent gives not_found');

-- paypage_hit
select has_index('public', 'paypage_hits', 'paypage_hits_hour_bucket_idx', array['hour_bucket'], 'the purge by hour has its own index');
insert into public.paypage_hits (key_hash, hour_bucket, n) values ('old', date_trunc('hour', now()) - interval '25 hours', 3);
set local role service_role;
select is((select array_agg(public.paypage_hit('hash-a', 5) order by g) from generate_series(1, 6) g),
  array[true, true, true, true, true, false], 'five calls are within the limit, the sixth is not');
select is(public.paypage_hit('hash-b', 5), true, 'another hash starts its own count');
reset role;
select is((select n from public.paypage_hits where key_hash = 'hash-a'), 6, 'the counter holds the number of calls');
select is((select count(*) from public.paypage_hits where key_hash = 'old')::int, 0, 'a row more than a day old is removed by the next call');
select is((select count(*) from public.receipt_hits where key_hash in ('hash-a', 'hash-b'))::int + (select count(*) from public.waitlist_hits where ip_hash in ('hash-a', 'hash-b'))::int, 0, 'pay page counts are kept apart from the receipt and waitlist counts');

select * from finish();
rollback;
