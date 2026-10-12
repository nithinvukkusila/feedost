-- R1-7 Part A review fix. sync_opening_due() (20261012100000_r1_dues.sql) deletes or follows the opening due while
-- amount_paid = 0. After a part payment is undone, amount_paid is 0 again but a voided payments row still points at
-- the due (payments_due_fkey, deferred), so the delete failed at commit (23503) and the student could not be saved.
-- Re-created here: an opening due that has any payments row, voided or not, is never deleted or changed by the
-- trigger. Everything else is as before. The triggers already point at this function name, so create or replace
-- is enough; its privileges (revoked from public, anon, authenticated) stay.
create or replace function public.sync_opening_due()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date)
    values (new.tutor_id, new.id, 'opening', null, new.opening_balance, 0, 'due', public.india_day(now()))
    on conflict do nothing;
  else
    if new.opening_balance > 0 then
      insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date)
      values (new.tutor_id, new.id, 'opening', null, new.opening_balance, 0, 'due', public.india_day(now()))
      on conflict do nothing;
      update public.dues
         set amount = new.opening_balance
       where student_id = new.id and kind = 'opening' and amount_paid = 0
         and not exists (select 1 from public.payments p where p.due_id = dues.id);
    else
      delete from public.dues
       where student_id = new.id and kind = 'opening' and amount_paid = 0
         and not exists (select 1 from public.payments p where p.due_id = dues.id);
    end if;
  end if;
  return null;
end;
$$;
