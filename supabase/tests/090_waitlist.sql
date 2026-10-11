-- R0-4 (docs/specs/R0-4-waitlist.md criteria 1, 2, 3, 13, 15). public.waitlist and public.waitlist_hits:
-- the checks hold, RLS is on with no policy, nobody but the service role can touch them, and waitlist_hit counts
-- per hash per hour. There is no tutor_id here, so "tutor B" is the same test as "tutor A": neither can see a row.
-- Self-contained: rolls everything back.
begin;
select tests.assert_ready();
select plan(52);

-- Shape ---------------------------------------------------------------------------------------------
select has_table('public', 'waitlist', 'waitlist exists');
select has_table('public', 'waitlist_hits', 'waitlist_hits exists');
select columns_are('public', 'waitlist',
  array['id', 'name', 'phone', 'city', 'students_count', 'language', 'created_at'],
  'waitlist has exactly the PRD columns');
select ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'waitlist' and column_name = 'tutor_id'),
  'waitlist has no tutor_id');

-- RLS on, no policies ------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.waitlist'::regclass), 'RLS is on for waitlist');
select ok((select relrowsecurity from pg_class where oid = 'public.waitlist_hits'::regclass), 'RLS is on for waitlist_hits');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'waitlist')::int, 0, 'waitlist has no policy');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'waitlist_hits')::int, 0, 'waitlist_hits has no policy');

-- Privileges ---------------------------------------------------------------------------------------
select ok(not has_any_column_privilege('anon', 'public.waitlist', 'select,insert,update,references'), 'anon holds no privilege on waitlist');
select ok(not has_any_column_privilege('authenticated', 'public.waitlist', 'select,insert,update,references'), 'authenticated holds no privilege on waitlist');
select ok(not has_table_privilege('anon', 'public.waitlist', 'select,insert,update,delete,truncate,references,trigger'), 'anon holds no table privilege on waitlist');
select ok(not has_table_privilege('authenticated', 'public.waitlist', 'select,insert,update,delete,truncate,references,trigger'), 'authenticated holds no table privilege on waitlist');
select ok(not has_any_column_privilege('anon', 'public.waitlist_hits', 'select,insert,update,references'), 'anon holds no privilege on waitlist_hits');
select ok(not has_any_column_privilege('authenticated', 'public.waitlist_hits', 'select,insert,update,references'), 'authenticated holds no privilege on waitlist_hits');
select ok(has_table_privilege('service_role', 'public.waitlist', 'select,insert'), 'service_role can read and write waitlist');
select ok(has_table_privilege('service_role', 'public.waitlist_hits', 'select,insert,update,delete'), 'service_role can use waitlist_hits');
select ok(not has_function_privilege('anon', 'public.waitlist_hit(text, integer)', 'execute'), 'anon cannot execute waitlist_hit');
select ok(not has_function_privilege('authenticated', 'public.waitlist_hit(text, integer)', 'execute'), 'authenticated cannot execute waitlist_hit');
select ok(has_function_privilege('service_role', 'public.waitlist_hit(text, integer)', 'execute'), 'service_role can execute waitlist_hit');
select ok(not (select prosecdef from pg_proc where oid = 'public.waitlist_hit(text, integer)'::regprocedure), 'waitlist_hit is security invoker');

-- Seed one row as the test runner (the owner) ----------------------------------------------------
insert into public.waitlist (name, phone, city, students_count, language)
  values ('Asha Rao', '+919876543210', 'Bengaluru', 10, 'en');

-- anon, tutor A and tutor B: every operation on both tables fails ---------------------------------
select tests.act_as_anon();
select throws_ok($$select count(*) from public.waitlist$$, '42501', null, 'anon cannot select waitlist');
select throws_ok($$insert into public.waitlist (name, phone, city, students_count, language) values ('X', '+919876543211', 'Y', 0, 'en')$$, '42501', null, 'anon cannot insert into waitlist');
select throws_ok($$update public.waitlist set name = 'x'$$, '42501', null, 'anon cannot update waitlist');
select throws_ok($$delete from public.waitlist$$, '42501', null, 'anon cannot delete from waitlist');
select throws_ok($$select count(*) from public.waitlist_hits$$, '42501', null, 'anon cannot select waitlist_hits');
select throws_ok($$select public.waitlist_hit('h', 5)$$, '42501', null, 'anon cannot call waitlist_hit');
select tests.reset();

select tests.act_as(tests.tutor_a());
select throws_ok($$select count(*) from public.waitlist$$, '42501', null, 'tutor A cannot select waitlist');
select throws_ok($$insert into public.waitlist (name, phone, city, students_count, language) values ('X', '+919876543211', 'Y', 0, 'en')$$, '42501', null, 'tutor A cannot insert into waitlist');
select throws_ok($$update public.waitlist set name = 'x'$$, '42501', null, 'tutor A cannot update waitlist');
select throws_ok($$delete from public.waitlist$$, '42501', null, 'tutor A cannot delete from waitlist');
select throws_ok($$select count(*) from public.waitlist_hits$$, '42501', null, 'tutor A cannot select waitlist_hits');
select throws_ok($$select public.waitlist_hit('h', 5)$$, '42501', null, 'tutor A cannot call waitlist_hit');
select tests.reset();

select tests.act_as(tests.tutor_b());
select throws_ok($$select count(*) from public.waitlist$$, '42501', null, 'tutor B cannot select waitlist');
select throws_ok($$delete from public.waitlist$$, '42501', null, 'tutor B cannot delete from waitlist');
select tests.reset();

select is((select count(*) from public.waitlist)::int, 1, 'the seeded row is intact');

-- Checks (as the test runner, so only the constraint can refuse) ----------------------------------
select throws_ok($$insert into public.waitlist (name, phone, city, students_count, language) values ('A', '+915876543210', 'C', 0, 'en')$$, '23514', null, 'phone starting 5 is refused');
select throws_ok($$insert into public.waitlist (name, phone, city, students_count, language) values ('A', '+9198765', 'C', 0, 'en')$$, '23514', null, 'short phone is refused');
select throws_ok($$insert into public.waitlist (name, phone, city, students_count, language) values ('A', '9876543210', 'C', 0, 'en')$$, '23514', null, 'phone without +91 is refused');
select throws_ok($$insert into public.waitlist (name, phone, city, students_count, language) values ('A', '+9198765432101', 'C', 0, 'en')$$, '23514', null, 'phone with 11 digits is refused');
select throws_ok($$insert into public.waitlist (name, phone, city, students_count, language) values ('A', '+919876543212', 'C', 0, 'fr')$$, '23514', null, 'language fr is refused');
select throws_ok($$insert into public.waitlist (name, phone, city, students_count, language) values ('A', '+919876543212', 'C', 5, 'en')$$, '23514', null, 'students_count 5 is refused');
select throws_ok($$insert into public.waitlist (name, phone, city, students_count, language) values ('', '+919876543212', 'C', 0, 'en')$$, '23514', null, 'empty name is refused');
select throws_ok(format('insert into public.waitlist (name, phone, city, students_count, language) values (%L, %L, %L, 0, %L)', repeat('x', 61), '+919876543212', 'C', 'en'), '23514', null, '61-character name is refused');
select throws_ok(format('insert into public.waitlist (name, phone, city, students_count, language) values (%L, %L, %L, 0, %L)', 'A', '+919876543212', repeat('x', 41), 'en'), '23514', null, '41-character city is refused');
select lives_ok(format('insert into public.waitlist (name, phone, city, students_count, language) values (%L, %L, %L, 60, %L)', repeat('x', 60), '+919876543212', repeat('y', 40), 'te'), 'longest valid values are accepted');

-- Duplicate number: one row, the first one untouched (criterion 13) -------------------------------
select throws_ok($$insert into public.waitlist (name, phone, city, students_count, language) values ('Other', '+919876543210', 'Pune', 60, 'hi')$$, '23505', null, 'the same phone twice is refused by unique(phone)');
insert into public.waitlist (name, phone, city, students_count, language)
  values ('Other', '+919876543210', 'Pune', 60, 'hi') on conflict (phone) do nothing;
select is((select count(*) from public.waitlist where phone = '+919876543210')::int, 1, 'on conflict do nothing leaves one row');
select is((select name || '|' || city || '|' || students_count || '|' || language from public.waitlist where phone = '+919876543210'),
  'Asha Rao|Bengaluru|10|en', 'the first row keeps its name, city, count and language');

-- waitlist_hit (criterion 15), called as the service role ---------------------------------------
-- An old row, to see it expire on the next call
insert into public.waitlist_hits (ip_hash, hour_bucket, n) values ('old', date_trunc('hour', now()) - interval '25 hours', 3);

set local role service_role;
select is((select array_agg(public.waitlist_hit('hash-a', 5) order by g) from generate_series(1, 6) g),
  array[true, true, true, true, true, false], 'five calls are within the limit, the sixth is not');
select is(public.waitlist_hit('hash-b', 5), true, 'another hash starts its own count');
select is((select n from public.waitlist_hits where ip_hash = 'hash-a'), 6, 'the counter holds the number of calls');
select is((select count(*) from public.waitlist_hits where ip_hash = 'old')::int, 0, 'a row more than a day old is removed by the next call');
reset role;

select * from finish();
rollback;
