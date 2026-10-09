-- F4 plan section 6. After the baseline migration, a table or sequence that postgres creates in
-- public is out of reach of anon until a migration grants it. authenticated keeps its defaults.
begin;
select tests.assert_ready();
select plan(6);

create table public.priv_probe (id serial primary key, note text);

select ok(not has_table_privilege('anon', 'public.priv_probe', 'select'), 'anon cannot select a new table');
select ok(not has_table_privilege('anon', 'public.priv_probe', 'insert'), 'anon cannot insert into a new table');
select ok(not has_table_privilege('anon', 'public.priv_probe', 'update'), 'anon cannot update a new table');
select ok(not has_table_privilege('anon', 'public.priv_probe', 'delete'), 'anon cannot delete from a new table');
select ok(not has_sequence_privilege('anon', 'public.priv_probe_id_seq', 'usage'), 'anon cannot use a new sequence');
select ok(has_table_privilege('authenticated', 'public.priv_probe', 'select'), 'authenticated keeps its default on a new table');

select * from finish();
rollback;
