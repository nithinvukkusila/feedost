-- R1-10 Part A criteria 6 and 8 (docs/specs/R1-10-paid-claims-inbox.md, plan decision 5 and risk 8). open_dues_oldest_first is the one
-- definition of "the open fees, oldest first" used by submit_claim and confirm_claim. The Pay total on the parent's page and the
-- claim must agree, so its order is pinned equal to the open_dues order get_pay_page lists, for an earlier balance, fees with the
-- same due date, a paid fee and a part paid fee. No client can execute it.
-- Self-contained: makes its own users and rolls everything back.
begin;
select tests.assert_ready();
select plan(8);

insert into auth.users (id, email) values (tests.tutor_a(), 'tutor-a@example.test'), (tests.tutor_b(), 'tutor-b@example.test');
insert into public.students (id, tutor_id, name, pay_token) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'Order',  'OrdOrderToken_aaaaaaaaaa'),
  ('a1000000-0000-4000-8000-000000000002', tests.tutor_a(), 'Other',  'OrdOtherToken_aaaaaaaaaa'),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'Bhanu',  'OrdBhanuToken_bbbbbbbbbb');
insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values
  -- the earlier balance has the LATEST due date and still comes first
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'opening', null,         30000, 10000, 'partial', '2026-10-20'),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 120000, 0,    'due',     '2026-10-05'),
  -- the same due date as October, an earlier month: month decides
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-09-01', 90000, 40000, 'partial', '2026-10-05'),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-08-01', 100000, 0,    'due',     '2026-08-05'),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-07-01', 100000, 100000, 'paid',  '2026-07-05'),
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'monthly', '2026-10-01', 50000, 0,     'due',     '2026-10-05'),
  (tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 60000, 0,     'due',     '2026-10-05');
insert into public.consents (tutor_id, student_id, notice_version) values
  (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', public.current_notice_version());

select ok(not has_function_privilege('anon', 'public.open_dues_oldest_first(uuid, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.open_dues_oldest_first(uuid, uuid)', 'execute')
  and not has_function_privilege('public', 'public.open_dues_oldest_first(uuid, uuid)', 'execute'), 'no client role can execute open_dues_oldest_first');

select is((select array_agg(kind || ':' || coalesce(month::text, '-') order by ordinality)
             from public.open_dues_oldest_first(tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001') with ordinality),
  array['opening:-', 'monthly:2026-08-01', 'monthly:2026-09-01', 'monthly:2026-10-01'],
  'the earlier balance first, then by due date, then by month; the paid fee is absent');

select is((select array_agg(kind || ':' || coalesce(month::text, '-') order by ordinality)
             from public.open_dues_oldest_first(tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001') with ordinality),
  (select array_agg((e->>'kind') || ':' || coalesce(e->>'month', '-') order by ord)
     from jsonb_array_elements(public.get_pay_page('OrdOrderToken_aaaaaaaaaa')->'open_dues') with ordinality as t(e, ord)),
  'the order equals the open_dues order of get_pay_page');

select is((select sum(amount - amount_paid)::bigint from public.open_dues_oldest_first(tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001')),
  (public.get_pay_page('OrdOrderToken_aaaaaaaaaa')->>'total_remaining')::bigint, 'the total equals total_remaining of get_pay_page');

select is((select count(*) from public.open_dues_oldest_first(tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002'))::int, 1, 'another student of the tutor has her own one fee');
select is((select count(*) from public.open_dues_oldest_first(tests.tutor_a(), 'b1000000-0000-4000-8000-000000000001'))::int, 0, 'a student of another tutor gives nothing for this tutor');
select is((select count(*) from public.open_dues_oldest_first(tests.tutor_b(), 'a1000000-0000-4000-8000-000000000001'))::int, 0, 'another tutor gets nothing for this student');

select tests.act_as(tests.tutor_a());
select throws_ok($$select * from public.open_dues_oldest_first(tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001')$$, '42501', null, 'a signed-in tutor cannot call it');
select tests.reset();

select * from finish();
rollback;
