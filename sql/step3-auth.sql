-- Supabase SQL Editor에서 실행. 기존 메모 본문과 owner_id 보존.
begin;
lock table public.learning_notes in access exclusive mode;
do $$
declare id_type text;
begin
  select data_type into id_type from information_schema.columns
    where table_schema='public' and table_name='learning_notes' and column_name='id';
  if id_type in ('integer','bigint','smallint') then
    alter table public.learning_notes alter column id drop default;
    alter table public.learning_notes alter column id type uuid using gen_random_uuid();
  elsif id_type is distinct from 'uuid' then
    raise exception 'learning_notes.id 자료형을 먼저 확인하세요';
  end if;
end $$;
alter table public.learning_notes alter column id set default gen_random_uuid();
alter table public.learning_notes enable row level security;
revoke all on table public.learning_notes from public, anon, authenticated;
grant select, insert, update, delete on table public.learning_notes to service_role;
commit;
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='learning_notes' and column_name in ('id','owner_id');
select count(*) as preserved_note_count from public.learning_notes;
