-- R1-9 Part A criterion 6, found by test-engineer: "total_remaining is the sum over all open dues ... Amounts are integer
-- paise." dues.amount is an integer capped at 100000000 paise (Rs 10,00,000) and get_pay_page casts the SUM to integer
-- (v_total::integer). 22 open fees at the cap add up to 2,200,000,000 paise, which does not fit an integer (limit
-- 2,147,483,647), so the cast raises "integer out of range" and the whole page fails (the Edge Function answers 500)
-- instead of showing the total. EXPECTED TO FAIL until get_pay_page keeps the sum as bigint (a JSON number holds it).
-- Rs 21 lakh outstanding is unlikely for a home tutor, which is why this is low severity; it is still a page that cannot open.
begin;
select tests.assert_ready();
select plan(2);

insert into auth.users (id, email) values (tests.tutor_a(), 'tutor-a@example.test');
update public.tutors set name = 'Asha Rao', upi_id = 'asha@okbank' where id = tests.tutor_a();
insert into public.students (id, tutor_id, name, pay_token) values
  ('a1000000-0000-4000-8000-0000000000c1', tests.tutor_a(), 'Big', 'GapBigToken_aaaaaaaaaaaa');
insert into public.consents (tutor_id, student_id, notice_version) values
  (tests.tutor_a(), 'a1000000-0000-4000-8000-0000000000c1', public.current_notice_version());
insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date)
select tests.tutor_a(), 'a1000000-0000-4000-8000-0000000000c1', 'monthly', (date '2024-01-01' + g * interval '1 month')::date, 100000000, 0, 'due',
       (date '2024-01-05' + g * interval '1 month')::date
  from generate_series(0, 21) g;

select lives_ok($$select public.get_pay_page('GapBigToken_aaaaaaaaaaaa')$$, 'a page with 22 open fees of Rs 10,00,000 can be read');
select is(public.get_pay_page('GapBigToken_aaaaaaaaaaaa')->'total_remaining', '2200000000'::jsonb, 'and its total is 2,200,000,000 paise');

select * from finish();
rollback;
