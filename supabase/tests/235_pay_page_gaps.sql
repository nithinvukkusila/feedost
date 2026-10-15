-- R1-9 Part A, test-engineer additions to 220 and 230 (docs/specs/R1-9-parent-pay-page.md, criteria 3 to 10).
-- Gaps closed here: service_role really can call record_consent; the first agreement time is kept when the parent agrees
-- again; open fees sort by due date then month after the earlier balance; money in the answer is a JSON number; an archived
-- student that had agreed still gives not_found; newline and look-alike characters in a token; a tutor with no name and no
-- UPI id still gets the fixed key lists (keys present with null); the four functions pin search_path; the counter starts
-- again in a new hour; and a NEW NOTICE VERSION asks every parent again (the notice function is replaced inside this
-- transaction, which is rolled back at the end).
-- Self-contained: makes its own users and rolls everything back. Answers are read as the test runner, which owns the
-- security definer functions; service_role is used only where the call by the Edge Functions' own role is the point.
begin;
select tests.assert_ready();
select plan(32);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
update public.tutors set name = 'Asha Rao', subjects = array['Maths'], language = 'en', upi_id = 'asha@okbank' where id = tests.tutor_a();
update public.tutors set name = null, upi_id = null where id = tests.tutor_b();

insert into public.students (id, tutor_id, name, active, pay_token) values
  ('a1000000-0000-4000-8000-0000000000a1', tests.tutor_a(), 'Late',    true,  'GapLateToken_aaaaaaaaaaa'),
  ('a1000000-0000-4000-8000-0000000000a2', tests.tutor_a(), 'Order',   true,  'GapOrderToken_aaaaaaaaaa'),
  ('a1000000-0000-4000-8000-0000000000a3', tests.tutor_a(), 'Old',     false, 'GapOldToken_aaaaaaaaaaaa'),
  ('a1000000-0000-4000-8000-0000000000a5', tests.tutor_a(), 'Bump',    true,  'GapBumpToken_aaaaaaaaaaa'),
  ('b1000000-0000-4000-8000-0000000000b1', tests.tutor_b(), 'Bare',    true,  'GapBareToken_bbbbbbbbbbb'),
  ('b1000000-0000-4000-8000-0000000000b2', tests.tutor_b(), 'BareNew', true,  'GapBareNewToken_bbbbbbb');

-- Order: inserted out of order on purpose. Expected order: the earlier balance, then 5 Oct (Aug), then 20 Oct (Sep before Oct).
insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values
  (tests.tutor_a(), 'a1000000-0000-4000-8000-0000000000a2', 'monthly', '2026-10-01', 5000, 0, 'due', '2026-10-20'),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-0000000000a2', 'monthly', '2026-09-01', 3000, 0, 'due', '2026-10-20'),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-0000000000a2', 'monthly', '2026-08-01', 1000, 0, 'due', '2026-10-05'),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-0000000000a2', 'opening', null,         700,  0, 'due', '2026-12-01'),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-0000000000a5', 'monthly', '2026-10-01', 424200, 0, 'due', '2026-10-05');

insert into public.consents (tutor_id, student_id, notice_version) values
  (tests.tutor_a(), 'a1000000-0000-4000-8000-0000000000a2', 'v1'),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-0000000000a3', 'v1'),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-0000000000a5', 'v1'),
  (tests.tutor_b(), 'b1000000-0000-4000-8000-0000000000b1', 'v1');

-- The Edge Functions' own role can record a consent, and a second agreement keeps the first time
set local role service_role;
select is(public.record_consent('GapLateToken_aaaaaaaaaaa', 'v1'), 'ok', 'service_role can record a consent');
reset role;
select is((select count(*) from public.consents where student_id = 'a1000000-0000-4000-8000-0000000000a1')::int, 1, 'and it wrote one row');
update public.consents set accepted_at = timestamptz '2026-01-01 00:00+00' where student_id = 'a1000000-0000-4000-8000-0000000000a1';
select is(public.record_consent('GapLateToken_aaaaaaaaaaa', 'v1'), 'ok', 'a second agreement is ok');
select is((select accepted_at from public.consents where student_id = 'a1000000-0000-4000-8000-0000000000a1'), timestamptz '2026-01-01 00:00+00', 'and it keeps the time of the first agreement');

-- Order and money type
select is((select jsonb_agg(e->'month' order by i) from jsonb_array_elements(public.get_pay_page('GapOrderToken_aaaaaaaaaa')->'open_dues') with ordinality t(e, i)),
  '[null, "2026-08-01", "2026-09-01", "2026-10-01"]'::jsonb, 'earlier balance first, then by due date, then by month');
select is(public.get_pay_page('GapOrderToken_aaaaaaaaaa')->'total_remaining', '9700'::jsonb, 'the total is 5000 + 3000 + 1000 + 700 paise');
select is(jsonb_typeof(public.get_pay_page('GapOrderToken_aaaaaaaaaa')->'total_remaining'), 'number', 'the total is a JSON number, not text');
select is((select string_agg(distinct jsonb_typeof(e->k), ',') from jsonb_array_elements(public.get_pay_page('GapOrderToken_aaaaaaaaaa')->'open_dues') e, unnest(array['amount','amount_paid','remaining']) k),
  'number', 'amount, amount_paid and remaining of every open fee are JSON numbers');

-- Archived student that had agreed: still the same answer as unknown
select is(public.get_pay_page('GapOldToken_aaaaaaaaaaaa'), null, 'an archived student with a consent still gives null');
select is(public.record_consent('GapOldToken_aaaaaaaaaaaa', 'v1'), 'not_found', 'and record_consent gives not_found');

-- Tokens that look right but are not
select is(public.get_pay_page(E'GapLateToken_aaaaaaaaaaa\n'), null, 'a token with a trailing newline gives null');
select is(public.record_consent(E'GapLateToken_aaaaaaaaaaa\n', 'v1'), 'not_found', 'record_consent: a trailing newline is not_found');
select is(public.get_pay_page('GapLateToken_aaaaaaaaaa' || chr(1072)), null, 'a Cyrillic look-alike last letter gives null');

-- A tutor with no name and no UPI id: the keys are still all there, with null
select is((select array_agg(k order by k collate "C") from jsonb_object_keys(public.get_pay_page('GapBareNewToken_bbbbbbb')) k),
  array['consent_needed','language','notice_version','student_name','tutor_name','tutor_subjects'], 'a nameless tutor: still exactly six keys before consent');
select is(public.get_pay_page('GapBareNewToken_bbbbbbb')->'tutor_name', 'null'::jsonb, 'the tutor name is present as null');
select is(public.get_pay_page('GapBareNewToken_bbbbbbb')->'tutor_subjects', '[]'::jsonb, 'no subjects is an empty list');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys(public.get_pay_page('GapBareToken_bbbbbbbbbbb')) k),
  array['consent_needed','language','notice_version','open_dues','open_dues_more','pending_claim','receipts','receipts_more','student_name','today','total_remaining','tutor_name','tutor_subjects','upi_id'],
  'a tutor with no UPI id: still exactly fourteen keys after consent (R1-10: pending_claim added)');
select is(public.get_pay_page('GapBareToken_bbbbbbbbbbb')->'upi_id', 'null'::jsonb, 'the UPI id is present as null (the page can tell there is none)');

-- Definer functions fix their search path
select is((select count(*) from pg_proc
            where oid = any (array['public.get_pay_page(text)'::regprocedure, 'public.record_consent(text, text)'::regprocedure,
                                   'public.paypage_hit(text, integer)'::regprocedure, 'public.current_notice_version()'::regprocedure])
              and proconfig @> array['search_path=""'])::int, 4, 'the four functions pin an empty search_path');

-- The counter starts again in a new hour and keeps the old hour's row
insert into public.paypage_hits (key_hash, hour_bucket, n) values ('gap-hour', date_trunc('hour', now()) - interval '1 hour', 100);
set local role service_role;
select is(public.paypage_hit('gap-hour', 5), true, 'a hash that was over the limit an hour ago is within it in the new hour');
reset role;
select is((select count(*) from public.paypage_hits where key_hash = 'gap-hour')::int, 2, 'the new hour has its own row');
select is((select n from public.paypage_hits where key_hash = 'gap-hour' and hour_bucket = date_trunc('hour', now()) - interval '1 hour'), 100, 'and the earlier hour is untouched');

-- A new notice version asks every parent again
select is(public.get_pay_page('GapBumpToken_aaaaaaaaaaa')->'consent_needed', 'false'::jsonb, 'Bump agreed to v1, so the page opens straight to the fee');
create or replace function public.current_notice_version() returns text language sql immutable set search_path = '' as $$ select 'v2'::text $$;
select is(public.get_pay_page('GapBumpToken_aaaaaaaaaaa')->'consent_needed', 'true'::jsonb, 'after the notice changes to v2, the v1 agreement no longer counts');
select is(public.get_pay_page('GapBumpToken_aaaaaaaaaaa')->'notice_version', '"v2"'::jsonb, 'and the page asks for v2');
select ok(public.get_pay_page('GapBumpToken_aaaaaaaaaaa')::text !~ '(424200|asha@okbank|upi_id|total_remaining|open_dues|receipts)', 'and no fee, UPI id or list is in the answer while it asks again');
select is(public.record_consent('GapBumpToken_aaaaaaaaaaa', 'v1'), 'stale_notice', 'a page that still shows v1 gets stale_notice');
select is(public.record_consent('GapBumpToken_aaaaaaaaaaa', 'v2'), 'ok', 'agreeing to v2 is ok');
select is((select count(*) from public.consents where student_id = 'a1000000-0000-4000-8000-0000000000a5')::int, 2, 'the v1 row stays as a record and a v2 row is added');
select is(public.get_pay_page('GapBumpToken_aaaaaaaaaaa')->'consent_needed', 'false'::jsonb, 'after agreeing to v2 the page opens to the fee again');
select is(public.get_pay_page('GapOrderToken_aaaaaaaaaa')->'consent_needed', 'true'::jsonb, 'another student who agreed only to v1 is asked again');
select ok(has_function_privilege('service_role', 'public.current_notice_version()', 'execute') and not has_function_privilege('anon', 'public.current_notice_version()', 'execute') and not has_function_privilege('authenticated', 'public.current_notice_version()', 'execute'),
  'replacing the notice function keeps its privileges (service_role only)');

select * from finish();
rollback;
