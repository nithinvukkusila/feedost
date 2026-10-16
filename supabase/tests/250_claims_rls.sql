-- R1-10 Part A criteria 1 and 2 (docs/specs/R1-10-paid-claims-inbox.md, plan sections 3 and 9). public.payment_claims has one policy
-- (select); a tutor reads only their own claims; no client can write at all (42501); anon has nothing; the table holds no personal
-- column; the checks, the composite foreign keys and the cascades hold; claim_hits has RLS and no grant.
-- Self-contained: makes its own users and rolls everything back. Fixtures are made as the test runner (the table owner).
begin;
select tests.assert_ready();
select plan(66);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
insert into public.students (id, tutor_id, name) values
  ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'A one'),
  ('a1000000-0000-4000-8000-000000000002', tests.tutor_a(), 'A two'),
  ('a1000000-0000-4000-8000-000000000003', tests.tutor_a(), 'A three'),
  ('b1000000-0000-4000-8000-000000000001', tests.tutor_b(), 'B one');
insert into public.dues (id, tutor_id, student_id, kind, month, amount, due_date) values
  ('a2000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'opening', null, 120000, '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('a2000000-0000-4000-8000-000000000003', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('b2000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'monthly', '2026-10-01', 90000, '2026-10-05');
-- A one's fee is its earlier balance: the student now says so too (the trigger finds the due and keeps its id)
update public.students set opening_balance = 120000 where id = 'a1000000-0000-4000-8000-000000000001';
-- A one's claim is already handled (rejected): a pending claim freezes its fee and is never cascaded (255_claims_opening_due.sql)
insert into public.payment_claims (id, tutor_id, student_id, due_id, amount, fee_count, upi_ref, status, handled_at) values
  ('a6000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 120000, 1, '628104739915', 'rejected', now());
insert into public.payment_claims (id, tutor_id, student_id, due_id, amount, fee_count, upi_ref) values
  ('a6000000-0000-4000-8000-000000000002', tests.tutor_a(), 'a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 100000, 1, '111111111111'),
  ('b6000000-0000-4000-8000-000000000001', tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 90000, 1, '222222222222');

-- Shape: row-level security, one policy, no personal column, no default tutor
select ok((select relrowsecurity from pg_class where oid = 'public.payment_claims'::regclass), 'row-level security is on for payment_claims');
select is((select string_agg(policyname::text, ',' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'payment_claims'), 'payment_claims_select', 'payment_claims_select is the only policy');
select is((select cmd::text from pg_policies where schemaname = 'public' and tablename = 'payment_claims' and policyname = 'payment_claims_select'), 'SELECT', 'payment_claims_select is for select');
select is((select roles::text from pg_policies where schemaname = 'public' and tablename = 'payment_claims' and policyname = 'payment_claims_select'), '{authenticated}', 'payment_claims_select is for authenticated only');
select is((select array_agg(column_name::text order by column_name::text collate "C") from information_schema.columns where table_schema = 'public' and table_name = 'payment_claims'),
  array['amount','confirm_request_id','confirmed_receipt_count','confirmed_receipt_from','created_at','due_id','fee_count','handled_at','id','screenshot_path','status','student_id','tutor_id','upi_ref'],
  'payment_claims has exactly fourteen columns and no name, phone or other personal column');
select ok((select column_default is null from information_schema.columns where table_schema = 'public' and table_name = 'payment_claims' and column_name = 'tutor_id'), 'payment_claims.tutor_id has no default');
select ok((select is_nullable = 'NO' from information_schema.columns where table_schema = 'public' and table_name = 'payment_claims' and column_name = 'tutor_id'), 'payment_claims.tutor_id is not null');
select ok((select data_type = 'integer' from information_schema.columns where table_schema = 'public' and table_name = 'payment_claims' and column_name = 'amount'), 'amount is integer paise');

-- Reads
select tests.act_as(tests.tutor_a());
select is((select count(*) from public.payment_claims)::int, 2, 'A reads own two claims');
select tests.reset();
select tests.act_as(tests.tutor_b());
select is((select count(*) from public.payment_claims)::int, 1, 'B reads only own claim');
select is((select count(*) from public.payment_claims where tutor_id = tests.tutor_a())::int, 0, 'B reads none of A claims by tutor_id');
select is((select count(*) from public.payment_claims where student_id = 'a1000000-0000-4000-8000-000000000001')::int, 0, 'B reads none of A claims by student_id');
select is((select count(*) from public.payment_claims where due_id = 'a2000000-0000-4000-8000-000000000001')::int, 0, 'B reads none of A claims by due_id');
select is((select count(*) from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000001')::int, 0, 'B reads none of A claims by id');
select is((select count(*) from public.payment_claims where upi_ref = '628104739915')::int, 0, 'B reads none of A claims by UPI reference');
select is((select count(*) from public.payment_claims c join public.dues d on d.id = c.due_id where d.tutor_id = tests.tutor_a())::int, 0, 'B reads none of A claims through a join to dues');
select is((select count(*) from public.payment_claims c join public.students s on s.id = c.student_id where s.tutor_id = tests.tutor_a())::int, 0, 'B reads none of A claims through a join to students');
select tests.reset();

-- B cannot write (the privilege check comes before row-level security)
select tests.act_as(tests.tutor_b());
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_b(), 'b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 1000, 1, '333333333333')$$, '42501', null, 'B cannot insert a claim, not even for own student');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 1, '333333333333')$$, '42501', null, 'B cannot insert a claim for A student');
select throws_ok($$update public.payment_claims set status = 'rejected' where id = 'a6000000-0000-4000-8000-000000000001'$$, '42501', null, 'B cannot update A claim');
select throws_ok($$delete from public.payment_claims where id = 'a6000000-0000-4000-8000-000000000001'$$, '42501', null, 'B cannot delete A claim');
select tests.reset();

-- A cannot write own claims either: only the three functions do
select tests.act_as(tests.tutor_a());
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 1, '333333333333')$$, '42501', null, 'A cannot insert a claim');
select throws_ok($$update public.payment_claims set status = 'confirmed'$$, '42501', null, 'A cannot update a claim');
select throws_ok($$update public.payment_claims set amount = 1$$, '42501', null, 'A cannot edit the amount of a claim');
select throws_ok($$delete from public.payment_claims$$, '42501', null, 'A cannot delete a claim');
select throws_ok($$truncate public.payment_claims$$, '42501', null, 'A cannot truncate claims');
select tests.reset();

-- No session
select tests.act_as_anon();
select throws_ok($$select count(*) from public.payment_claims$$, '42501', null, 'no session cannot select claims');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 1, '333333333333')$$, '42501', null, 'no session cannot insert claims');
select throws_ok($$update public.payment_claims set status = 'confirmed'$$, '42501', null, 'no session cannot update claims');
select throws_ok($$delete from public.payment_claims$$, '42501', null, 'no session cannot delete claims');
select throws_ok($$select count(*) from public.claim_hits$$, '42501', null, 'no session cannot read claim_hits');
select tests.reset();

-- Privileges, read from the catalogue
select ok(has_table_privilege('authenticated', 'public.payment_claims', 'select'), 'authenticated reads payment_claims');
select ok(not has_table_privilege('authenticated', 'public.payment_claims', 'insert,update,delete,truncate,references,trigger'), 'authenticated holds no write, truncate, references or trigger privilege on payment_claims');
select ok(not has_any_column_privilege('authenticated', 'public.payment_claims', 'insert,update,references'), 'authenticated holds no column privilege to write payment_claims');
select ok(not has_table_privilege('anon', 'public.payment_claims', 'select,insert,update,delete,truncate,references,trigger'), 'anon holds no privilege on payment_claims');
select ok(not has_any_column_privilege('anon', 'public.payment_claims', 'select,insert,update,references'), 'anon holds no column privilege on payment_claims');

-- claim_hits: RLS on, no policy, no client grant, hashes only
select ok((select relrowsecurity from pg_class where oid = 'public.claim_hits'::regclass), 'row-level security is on for claim_hits');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'claim_hits')::int, 0, 'claim_hits has no policy');
select ok(not has_table_privilege('anon', 'public.claim_hits', 'select,insert,update,delete'), 'anon has no privilege on claim_hits');
select ok(not has_table_privilege('authenticated', 'public.claim_hits', 'select,insert,update,delete'), 'authenticated has no privilege on claim_hits');
select is((select array_agg(column_name::text order by column_name::text collate "C") from information_schema.columns where table_schema = 'public' and table_name = 'claim_hits'),
  array['hour_bucket','key_hash','n'], 'claim_hits holds only a hash, an hour and a count (no tutor_id, no raw value)');

-- Checks, as the table owner (check constraints are decided before the keys and the unique indexes)
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 1, '62810473991')$$, '23514', null, 'an 11 digit reference is refused');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 1, '6281047399151')$$, '23514', null, 'a 13 digit reference is refused');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 1, '62810473991a')$$, '23514', null, 'a reference with a letter is refused');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 1, E'०१२३४५६७८९०१')$$, '23514', null, 'twelve Devanagari digits are refused');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 1, '6281 0473 9915')$$, '23514', null, 'a reference with spaces is refused (the function removes them first)');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 1)$$, '23514', null, 'a claim with neither proof is refused');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 0, 1, '333333333333')$$, '23514', null, 'an amount of 0 is refused');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', -5, 1, '333333333333')$$, '23514', null, 'a negative amount is refused');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 2000000001, 1, '333333333333')$$, '23514', null, 'an amount over 2,000,000,000 paise is refused');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 0, '333333333333')$$, '23514', null, 'a fee count of 0 is refused');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref, status) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 1, '333333333333', 'paid')$$, '23514', null, 'a status of paid is refused');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref, screenshot_path) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 1, null, '../x.png')$$, '23514', null, 'a screenshot path outside the folder shape is refused');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref, status) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 1, '333333333333', 'rejected')$$, '23514', null, 'a rejected claim with no handled time is refused');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref, status, handled_at) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 1, '333333333333', 'confirmed', now())$$, '23514', null, 'a confirmed claim with no request id or receipt range is refused');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref, status, handled_at, confirm_request_id, confirmed_receipt_from, confirmed_receipt_count) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 1, '333333333333', 'rejected', now(), gen_random_uuid(), 1, 1)$$, '23514', null, 'a rejected claim that carries a receipt range is refused');

-- Foreign keys: a fee of another student or another tutor, and a student of another tutor, are refused
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001', 1000, 1, '333333333333')$$, '23503', null, 'a claim naming another student fee of the same tutor breaks the foreign key');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001', 1000, 1, '333333333333')$$, '23503', null, 'a claim naming another tutor fee breaks the foreign key');
select throws_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref, status, handled_at) values (tests.tutor_a(), 'b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 1000, 1, '333333333333', 'rejected', now())$$, '23503', null, 'a claim naming tutor A with tutor B student breaks the foreign key');
select lives_ok($$insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref) values (tests.tutor_a(), 'a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 1000, 1, '333333333333')$$, 'a well formed claim is accepted');

-- Deleting a student removes its claims; a fee deleted by the earlier-balance trigger takes its handled claims; deleting a tutor
-- removes the rest
delete from public.students where id = 'a1000000-0000-4000-8000-000000000002';
select is((select count(*) from public.payment_claims where student_id = 'a1000000-0000-4000-8000-000000000002')::int, 0, 'deleting a student removes its claims');
select is((select count(*) from public.payment_claims where tutor_id = tests.tutor_a())::int, 2, 'and leaves the same tutor other claims');
update public.students set opening_balance = 0 where id = 'a1000000-0000-4000-8000-000000000001';
select is((select count(*) from public.dues where id = 'a2000000-0000-4000-8000-000000000001')::int, 0, 'clearing the earlier balance deletes its fee (no payment, no pending claim)');
select is((select count(*) from public.payment_claims where due_id = 'a2000000-0000-4000-8000-000000000001')::int, 0, 'a fee deleted by the earlier-balance trigger takes its handled claims with it (criterion 2)');
delete from auth.users where id = tests.tutor_a();
select is((select count(*) from public.payment_claims where tutor_id = tests.tutor_a())::int, 0, 'deleting a tutor removes all their claims');
select is((select count(*) from public.payment_claims where tutor_id = tests.tutor_b())::int, 1, 'and leaves the other tutor claims');

select * from finish();
rollback;
