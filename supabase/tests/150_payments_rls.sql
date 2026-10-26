-- R1-7 Part A criteria 1, 2, 9, 10 (docs/specs/R1-7-record-payment.md, plan sections 2 and 6). public.payments has one
-- policy (select); a tutor reads only their own payments; no client can write at all (42501); anon has nothing;
-- receipt_counters has no policy and no grant; the shape checks hold; deleting a tutor removes their payments.
-- Self-contained: makes its own users and rolls everything back. Fixtures are made as the test runner (the table
-- owner). Cross-tutor reads run as the attacker (B).
begin;
select tests.assert_ready();
select plan(44);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
insert into public.students (id, tutor_id, name) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'A one'),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'B one');
insert into public.dues (id, tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) values
  ('a2000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 120000, 50000, 'partial', '2026-10-05'),
  ('b2000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 90000, 90000, 'paid', '2026-10-05');
insert into public.receipt_counters (tutor_id, last_no) values (tests.tutor_a(), 1), (tests.tutor_b(), 1);
insert into public.payments (id, tutor_id, due_id, amount, method, paid_on, receipt_no, request_id, balance_after) values
  ('a3000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a2000000-0000-4000-8000-000000000001', 50000, 'upi', '2026-10-06', 1, 'a4000000-0000-4000-8000-000000000001', 70000),
  ('b3000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b2000000-0000-4000-8000-000000000001', 90000, 'cash', '2026-10-06', 1, 'b4000000-0000-4000-8000-000000000001', 0);

-- Shape: row-level security, one policy
select ok((select relrowsecurity from pg_class where oid = 'public.payments'::regclass), 'row-level security is on for payments');
select ok((select relrowsecurity from pg_class where oid = 'public.receipt_counters'::regclass), 'row-level security is on for receipt_counters');
select is((select string_agg(policyname::text, ',' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'payments'), 'payments_select', 'payments_select is the only policy on payments');
select is((select cmd::text from pg_policies where schemaname = 'public' and tablename = 'payments' and policyname = 'payments_select'), 'SELECT', 'payments_select is for select');
select is((select roles::text from pg_policies where schemaname = 'public' and tablename = 'payments' and policyname = 'payments_select'), '{authenticated}', 'payments_select is for authenticated only');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'receipt_counters')::int, 0, 'receipt_counters has no policy');

-- Reads
select tests.act_as(tests.tutor_a());
select is((select count(*) from public.payments)::int, 1, 'A reads own payment');
select tests.reset();
select tests.act_as(tests.tutor_b());
select is((select count(*) from public.payments)::int, 1, 'B reads only own payment');
select is((select count(*) from public.payments where tutor_id = tests.tutor_a())::int, 0, 'B reads none of A payments by tutor_id');
select is((select count(*) from public.payments where due_id = 'a2000000-0000-4000-8000-000000000001')::int, 0, 'B reads none of A payments by due_id');
select is((select count(*) from public.payments where id = 'a3000000-0000-4000-8000-000000000001')::int, 0, 'B reads none of A payments by id');
select is((select count(*) from public.payments p join public.dues d on d.id = p.due_id where d.tutor_id = tests.tutor_a())::int, 0, 'B reads none of A payments through a join');
select is((select count(*) from public.payments where receipt_no = 1)::int, 1, 'B sees only its own number 1 (the same number exists for A)');
-- UX-review-fixes-2 13.3: the exact filter readPaymentsInMonth sends (paid_on=gte.2026-10-01&paid_on=lt.2026-11-01&voided_at=is.null)
-- A's payment is in that month and stands, yet B gets only its own row back.
select is((select string_agg(id::text, ',' order by paid_on, id) from public.payments where paid_on >= '2026-10-01' and paid_on < '2026-11-01' and voided_at is null), 'b3000000-0000-4000-8000-000000000001', 'B reads none of A payments with the month range filter the app sends, only its own');
select tests.reset();
select tests.act_as(tests.tutor_a());
select is((select count(*) from public.payments where paid_on >= '2026-10-01' and paid_on < '2026-11-01' and voided_at is null)::int, 1, 'A reads own payment with the same month range filter (the filter itself matches)');
select tests.reset();
select tests.act_as(tests.tutor_b());

-- B cannot write (the privilege check comes before row-level security)
select throws_ok($$insert into public.payments (tutor_id, due_id, amount, method, paid_on, receipt_no, request_id, balance_after) values (tests.tutor_b(), 'b2000000-0000-4000-8000-000000000001', 1, 'cash', '2026-10-06', 9, gen_random_uuid(), 0)$$, '42501', null, 'B cannot insert a payment, not even for own due');
select throws_ok($$insert into public.payments (tutor_id, due_id, amount, method, paid_on, receipt_no, request_id, balance_after) values (tests.tutor_a(), 'a2000000-0000-4000-8000-000000000001', 1, 'cash', '2026-10-06', 9, gen_random_uuid(), 0)$$, '42501', null, 'B cannot insert a payment for A due');
select throws_ok($$update public.payments set amount = 1 where id = 'a3000000-0000-4000-8000-000000000001'$$, '42501', null, 'B cannot update A payment');
select throws_ok($$update public.payments set voided_at = now()$$, '42501', null, 'B cannot void a payment by update');
select throws_ok($$delete from public.payments where id = 'a3000000-0000-4000-8000-000000000001'$$, '42501', null, 'B cannot delete A payment');
select throws_ok($$select * from public.receipt_counters$$, '42501', null, 'B cannot read receipt_counters');
select throws_ok($$update public.receipt_counters set last_no = 0$$, '42501', null, 'B cannot write receipt_counters');
select tests.reset();

-- A cannot write own payments either
select tests.act_as(tests.tutor_a());
select throws_ok($$insert into public.payments (tutor_id, due_id, amount, method, paid_on, receipt_no, request_id, balance_after) values (tests.tutor_a(), 'a2000000-0000-4000-8000-000000000001', 1, 'cash', '2026-10-06', 9, gen_random_uuid(), 0)$$, '42501', null, 'A cannot insert a payment');
select throws_ok($$update public.payments set amount = 1$$, '42501', null, 'A cannot update a payment');
select throws_ok($$delete from public.payments$$, '42501', null, 'A cannot delete a payment');
select tests.reset();

-- No session
select tests.act_as_anon();
select throws_ok($$select count(*) from public.payments$$, '42501', null, 'no session cannot select payments');
select throws_ok($$select count(*) from public.receipt_counters$$, '42501', null, 'no session cannot select receipt_counters');
select throws_ok($$delete from public.payments$$, '42501', null, 'no session cannot delete payments');
select tests.reset();

-- Privileges, read from the catalogue
select ok(has_table_privilege('authenticated', 'public.payments', 'select'), 'authenticated reads payments');
select ok(not has_table_privilege('authenticated', 'public.payments', 'insert,update,delete,truncate,references,trigger'), 'authenticated holds no write, truncate, references or trigger privilege on payments');
select ok(not has_any_column_privilege('authenticated', 'public.payments', 'insert,update,references'), 'authenticated holds no column privilege to write payments');
select ok(not has_table_privilege('anon', 'public.payments', 'select,insert,update,delete,truncate,references,trigger'), 'anon holds no privilege on payments');
select ok(not has_any_column_privilege('anon', 'public.payments', 'select,insert,update,references'), 'anon holds no column privilege on payments');
select ok(not has_table_privilege('anon', 'public.receipt_counters', 'select,insert,update,delete,truncate,references,trigger')
  and not has_table_privilege('authenticated', 'public.receipt_counters', 'select,insert,update,delete,truncate,references,trigger')
  and not has_any_column_privilege('anon', 'public.receipt_counters', 'select,insert,update,references')
  and not has_any_column_privilege('authenticated', 'public.receipt_counters', 'select,insert,update,references'),
  'neither anon nor authenticated holds any privilege on receipt_counters');

-- Column shapes
select ok((select column_default is null from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'tutor_id'), 'payments.tutor_id has no default');
select ok((select is_nullable = 'NO' from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'tutor_id'), 'payments.tutor_id is not null');
select ok((select count(*) = 1 and bool_and(receipt_token ~ '^[A-Za-z0-9_-]{22,}$') from public.payments where tutor_id = tests.tutor_a()), 'the token the database made is 22 or more URL-safe characters');
select isnt((select receipt_token from public.payments where id = 'a3000000-0000-4000-8000-000000000001'), (select receipt_token from public.payments where id = 'b3000000-0000-4000-8000-000000000001'), 'two payments get different tokens');
select throws_ok($$update public.payments set receipt_token = 'short' where id = 'a3000000-0000-4000-8000-000000000001'$$, 'P0001', 'payment_immutable', 'even the owner cannot change a token (and a short one would fail its check anyway)');
select throws_ok($$insert into public.payments (tutor_id, due_id, amount, method, paid_on, receipt_no, request_id, balance_after) values (tests.tutor_a(), 'a2000000-0000-4000-8000-000000000001', 1, 'gateway', '2026-10-06', 9, gen_random_uuid(), 0)$$, '23514', null, 'method gateway is refused');
select throws_ok($$insert into public.payments (tutor_id, due_id, amount, method, paid_on, receipt_no, request_id, balance_after) values (tests.tutor_a(), 'a2000000-0000-4000-8000-000000000001', 1, 'bank', '2026-10-06', 9, gen_random_uuid(), 0)$$, '23514', null, 'method bank is refused');
select throws_ok($$insert into public.payments (tutor_id, due_id, amount, method, paid_on, receipt_no, request_id, balance_after) values (tests.tutor_a(), 'a2000000-0000-4000-8000-000000000001', 0, 'cash', '2026-10-06', 9, gen_random_uuid(), 0)$$, '23514', null, 'amount 0 is refused');

-- Deleting a tutor removes their payments and counter (the only delete)
delete from public.tutors where id = tests.tutor_a();
select is((select count(*) from public.payments where tutor_id = tests.tutor_a())::int + (select count(*) from public.receipt_counters where tutor_id = tests.tutor_a())::int, 0, 'deleting a tutor removes their payments and counter');
select is((select count(*) from public.payments where tutor_id = tests.tutor_b())::int, 1, 'and leaves the other tutor payments');

select * from finish();
rollback;
