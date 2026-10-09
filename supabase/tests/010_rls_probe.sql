-- F4 criterion 9. A throw-away table with the four tutor_id = auth.uid() policies, built and
-- dropped inside one transaction. It proves the shape every later tutor table must have.
begin;
select tests.assert_ready();
select plan(12);

create table public.rls_probe (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null,
  note text not null
);
alter table public.rls_probe enable row level security;
create policy rls_probe_select on public.rls_probe for select using (true);
create policy rls_probe_insert on public.rls_probe for insert with check (tutor_id = auth.uid());
create policy rls_probe_update on public.rls_probe for update using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());
create policy rls_probe_delete on public.rls_probe for delete using (tutor_id = auth.uid());
-- Granted to anon as well, so a zero result for anon proves the policy, not a missing grant.
grant select, insert, update, delete on public.rls_probe to authenticated, anon;

insert into public.rls_probe (tutor_id, note) values (tests.tutor_a(), 'a-original');

-- Tutor A
select tests.act_as(tests.tutor_a());
select is((select count(*) from public.rls_probe)::int, 1, 'A reads own row');
select lives_ok($$insert into public.rls_probe (tutor_id, note) values (tests.tutor_a(), 'a-second')$$, 'A inserts own row');
select tests.reset();

-- Tutor B
select tests.act_as(tests.tutor_b());
select is((select count(*) from public.rls_probe)::int, 0, 'B reads zero rows');
select throws_ok(
  $$insert into public.rls_probe (tutor_id, note) values (tests.tutor_a(), 'b-forged')$$,
  '42501', null, 'B cannot insert a row for A');
select lives_ok($$update public.rls_probe set note = 'b-changed'$$, 'B update runs');
select lives_ok($$delete from public.rls_probe$$, 'B delete runs');
select tests.reset();

select is((select count(*) from public.rls_probe where tutor_id = tests.tutor_a())::int, 2, 'B changed and removed nothing of A');
select is((select count(*) from public.rls_probe where note like 'b-%')::int, 0, 'nothing B wrote exists');

-- Nobody signed in
select tests.act_as_anon();
select is((select count(*) from public.rls_probe)::int, 0, 'no session reads zero rows');
select throws_ok(
  $$insert into public.rls_probe (tutor_id, note) values (tests.tutor_a(), 'anon-forged')$$,
  '42501', null, 'no session cannot insert');
select lives_ok($$delete from public.rls_probe$$, 'no-session delete runs');
select tests.reset();

select is((select count(*) from public.rls_probe)::int, 2, 'no-session delete removed nothing');

select * from finish();
rollback;
