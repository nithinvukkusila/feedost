-- R1-8 Part A: the reminders log, record_reminder and last_reminders.
-- Plan: docs/specs/R1-8-reminders.md, "Technical plan, R1-8", section on Part A.
--
-- =============================================================================================================
-- THE CONTRACT THE FRONT END READS (the same block is appended to the spec)
-- =============================================================================================================
--
--   record_reminder(p_due uuid, p_template text, p_request_id uuid) returns timestamptz
--     p_template    '<tone>:<language>:<kind>', tone polite|firm, language en|hi|kn|te, kind month|balance
--     p_request_id  a uuid made once per Remind screen and reused on every retry
--   Returns ONE timestamptz: the time the reminder was logged (sent_at). A retry with the same request id returns
--   the SAME time and writes nothing, even if the fee has since been paid. A second reminder for the same fee on
--   the same day is allowed (the client asks the tutor first).
--
--   last_reminders() returns table (due_id uuid, last_sent_at timestamptz, times integer)
--   One row per unpaid fee of an active student that has at least one reminder. times = how many were logged.
--
-- Errors. Over PostgREST: { code: 'P0001', message: '<word>' } (HTTP 400), except not_signed_in (code 42501).
--   not_signed_in      no session, or a session with no user
--   invalid_argument   an argument is null, or the template is not of the form above
--   due_not_found      the fee does not exist OR belongs to another tutor (same word, so ids cannot be probed)
--   already_paid       the fee is paid in full
--   student_archived   the fee's student is archived
--   no_phone           the student has no parent phone
-- =============================================================================================================
--
-- The log holds ids, the template tag and times only: no phone, no name, no message text, no amount.
-- Written only by record_reminder; a client can read its own rows. One policy (select), the same departure from
-- the four-policy rule as payments and dues: no client write grant exists.

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  -- No default: no client ever inserts a reminder.
  tutor_id uuid not null references public.tutors (id) on delete cascade,
  due_id uuid not null,
  -- Released 1 opens WhatsApp by link. A later migration relaxes this for other channels.
  channel text not null default 'click_to_chat' check (channel = 'click_to_chat'),
  template text not null check (template ~ '^(polite|firm):(en|hi|kn|te):(month|balance)$'),
  request_id uuid not null,
  sent_at timestamptz not null default now(),
  constraint reminders_tutor_id_request_id_key unique (tutor_id, request_id),
  -- Same pattern as payments_due_fkey: the fee must belong to the same tutor; deferred so a tutor delete cascades.
  constraint reminders_due_fkey
    foreign key (tutor_id, due_id) references public.dues (tutor_id, id)
    on delete no action
    deferrable initially deferred
);

create index reminders_tutor_id_due_id_sent_at_idx on public.reminders (tutor_id, due_id, sent_at desc);

comment on table public.reminders is
  'One row per reminder the tutor opened in WhatsApp. Written only by record_reminder. Ids, template tag and time only.';

alter table public.reminders enable row level security;

create policy reminders_select on public.reminders
  for select to authenticated
  using (tutor_id = (select auth.uid()));

revoke all on public.reminders from anon, authenticated;
grant select on public.reminders to authenticated;

-- ---------------------------------------------------------------------------------------------
-- record_reminder
-- ---------------------------------------------------------------------------------------------

create function public.record_reminder(p_due uuid, p_template text, p_request_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tutor uuid;
  v_sent timestamptz;
  v_status text;
  v_active boolean;
  v_phone text;
begin
  v_tutor := (select auth.uid());
  if v_tutor is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  if p_due is null or p_template is null or p_request_id is null
     or p_template !~ '^(polite|firm):(en|hi|kn|te):(month|balance)$' then
    raise exception 'invalid_argument' using errcode = 'P0001';
  end if;

  -- A retry answers the same, before any other check.
  select r.sent_at into v_sent from public.reminders r where r.tutor_id = v_tutor and r.request_id = p_request_id;
  if found then
    return v_sent;
  end if;

  -- No row lock: no money moves here. Another tutor's fee and an unknown id give the same word.
  select d.status, s.active, s.parent_phone into v_status, v_active, v_phone
    from public.dues d
    join public.students s on s.id = d.student_id and s.tutor_id = d.tutor_id
   where d.id = p_due and d.tutor_id = v_tutor;
  if not found then
    raise exception 'due_not_found' using errcode = 'P0001';
  end if;
  if v_status = 'paid' then
    raise exception 'already_paid' using errcode = 'P0001';
  end if;
  if not v_active then
    raise exception 'student_archived' using errcode = 'P0001';
  end if;
  if v_phone is null or v_phone !~ '^\+91[0-9]{10}$' then
    raise exception 'no_phone' using errcode = 'P0001';
  end if;

  insert into public.reminders (tutor_id, due_id, template, request_id)
  values (v_tutor, p_due, p_template, p_request_id)
  on conflict (tutor_id, request_id) do nothing
  returning sent_at into v_sent;

  if v_sent is null then
    -- Lost a race with the same request id: answer with the winner's time.
    select r.sent_at into v_sent from public.reminders r where r.tutor_id = v_tutor and r.request_id = p_request_id;
  end if;
  return v_sent;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- last_reminders
-- ---------------------------------------------------------------------------------------------

-- Security invoker: row-level security already limits every table to the caller. The explicit tutor filter is a
-- second belt.
create function public.last_reminders()
returns table (due_id uuid, last_sent_at timestamptz, times integer)
language sql
security invoker
stable
set search_path = ''
as $$
  select r.due_id, max(r.sent_at) as last_sent_at, count(*)::integer as times
    from public.reminders r
    join public.dues d on d.id = r.due_id and d.tutor_id = r.tutor_id
    join public.students s on s.id = d.student_id and s.tutor_id = d.tutor_id
   where r.tutor_id = (select auth.uid())
     and d.status <> 'paid'
     and s.active
   group by r.due_id
$$;

revoke execute on function public.record_reminder(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.last_reminders() from public, anon, authenticated;
grant execute on function public.record_reminder(uuid, text, uuid) to authenticated;
grant execute on function public.last_reminders() to authenticated;
