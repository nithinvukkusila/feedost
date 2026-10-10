-- R1-2 (docs/specs/R1-1-signin-and-data-model.md section 8.6). The privileges on tutors, batches and students are
-- exactly the ones the migration lists: nothing for anon, no truncate, references or trigger for authenticated,
-- and only the planned columns writable. Reads the catalogue only; changes nothing.
begin;
select tests.assert_ready();
select plan(28);

-- anon: nothing at all, on the table or on any column
select ok(not has_table_privilege('anon', 'public.tutors', 'select,insert,update,delete,truncate,references,trigger'), 'anon holds no privilege on tutors');
select ok(not has_table_privilege('anon', 'public.batches', 'select,insert,update,delete,truncate,references,trigger'), 'anon holds no privilege on batches');
select ok(not has_table_privilege('anon', 'public.students', 'select,insert,update,delete,truncate,references,trigger'), 'anon holds no privilege on students');
select ok(not has_any_column_privilege('anon', 'public.tutors', 'select,insert,update,references'), 'anon holds no column privilege on tutors');
select ok(not has_any_column_privilege('anon', 'public.batches', 'select,insert,update,references'), 'anon holds no column privilege on batches');
select ok(not has_any_column_privilege('anon', 'public.students', 'select,insert,update,references'), 'anon holds no column privilege on students');

-- authenticated: no truncate, references or trigger
select ok(not has_table_privilege('authenticated', 'public.tutors', 'truncate,references,trigger'), 'authenticated lacks truncate, references, trigger on tutors');
select ok(not has_table_privilege('authenticated', 'public.batches', 'truncate,references,trigger'), 'authenticated lacks truncate, references, trigger on batches');
select ok(not has_table_privilege('authenticated', 'public.students', 'truncate,references,trigger'), 'authenticated lacks truncate, references, trigger on students');

-- tutors: read, and update four columns; no insert, no delete
select ok(has_table_privilege('authenticated', 'public.tutors', 'select'), 'authenticated reads tutors');
select ok(not has_any_column_privilege('authenticated', 'public.tutors', 'insert'), 'authenticated cannot insert into tutors, on any column');
select ok(not has_table_privilege('authenticated', 'public.tutors', 'delete'), 'authenticated cannot delete from tutors');
select ok(not has_table_privilege('authenticated', 'public.tutors', 'update'), 'authenticated has no table-wide update on tutors');
select is_empty(
  $$select c from unnest(array['name','subjects','upi_id','language']) as c where not has_column_privilege('authenticated', 'public.tutors', c, 'update')$$,
  'authenticated updates name, subjects, upi_id and language');
select is_empty(
  $$select c from unnest(array['id','email','created_at','updated_at']) as c where has_column_privilege('authenticated', 'public.tutors', c, 'update')$$,
  'authenticated cannot update id, email, created_at or updated_at');

-- batches: select and delete table-wide; insert and update by column (changed by the hardening migration)
select ok(has_table_privilege('authenticated', 'public.batches', 'select') and has_table_privilege('authenticated', 'public.batches', 'delete'),
  'authenticated reads and deletes batches');
select ok(not has_table_privilege('authenticated', 'public.batches', 'insert') and not has_table_privilege('authenticated', 'public.batches', 'update'),
  'authenticated has no table-wide insert or update on batches');
select is_empty(
  $$select c from unnest(array['id','name','timings']) as c where not has_column_privilege('authenticated', 'public.batches', c, 'insert')$$,
  'authenticated inserts id, name and timings on batches');
select is_empty(
  $$select c from unnest(array['tutor_id','created_at','updated_at']) as c where has_column_privilege('authenticated', 'public.batches', c, 'insert')$$,
  'authenticated cannot insert tutor_id, created_at or updated_at on batches');
select is_empty(
  $$select c from unnest(array['name','timings']) as c where not has_column_privilege('authenticated', 'public.batches', c, 'update')$$,
  'authenticated updates name and timings on batches');
select is_empty(
  $$select c from unnest(array['id','tutor_id','created_at','updated_at']) as c where has_column_privilege('authenticated', 'public.batches', c, 'update')$$,
  'authenticated cannot update id, tutor_id, created_at or updated_at on batches');

-- students: select and delete table-wide; insert and update by column
select ok(has_table_privilege('authenticated', 'public.students', 'select') and has_table_privilege('authenticated', 'public.students', 'delete'),
  'authenticated reads and deletes students');
select ok(not has_table_privilege('authenticated', 'public.students', 'insert') and not has_table_privilege('authenticated', 'public.students', 'update'),
  'authenticated has no table-wide insert or update on students');
select is_empty(
  $$select c from unnest(array['id','tutor_id','batch_id','name','parent_name','parent_phone','parent_language','monthly_fee','opening_balance','due_day','active']) as c
    where not has_column_privilege('authenticated', 'public.students', c, 'insert')$$,
  'authenticated inserts the eleven planned student columns');
select is_empty(
  $$select c from unnest(array['pay_token','created_at','updated_at']) as c where has_column_privilege('authenticated', 'public.students', c, 'insert')$$,
  'authenticated cannot insert pay_token, created_at or updated_at');
select is_empty(
  $$select c from unnest(array['batch_id','name','parent_name','parent_phone','parent_language','monthly_fee','opening_balance','due_day','active']) as c
    where not has_column_privilege('authenticated', 'public.students', c, 'update')$$,
  'authenticated updates the nine planned student columns');
select is_empty(
  $$select c from unnest(array['id','tutor_id','pay_token','created_at','updated_at']) as c where has_column_privilege('authenticated', 'public.students', c, 'update')$$,
  'authenticated cannot update id, tutor_id, pay_token, created_at or updated_at');
select ok(has_column_privilege('authenticated', 'public.students', 'pay_token', 'select'), 'authenticated can read pay_token');

select * from finish();
rollback;
