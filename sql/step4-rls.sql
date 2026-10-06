-- 검토 후 Supabase SQL Editor에서 실행. public.learning_notes만 변경합니다.
-- 적용 전: 명시적 GRANT 및 상속을 포함한 실제 권한
select 'before' as phase, grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema='public' and table_name='learning_notes'
and grantee in ('PUBLIC','anon','authenticated') order by grantee, privilege_type;
select 'before' as phase, r.role_name, p.privilege,
has_table_privilege(r.role_name,'public.learning_notes',p.privilege) as allowed
from (values ('anon'),('authenticated')) r(role_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege);
select policyname, roles, cmd, qual, with_check from pg_policies
where schemaname='public' and tablename='learning_notes';

begin;
alter table public.learning_notes enable row level security;
revoke all on table public.learning_notes from PUBLIC, anon, authenticated;
-- 테이블 권한과 별개인 기존 열 단위 GRANT도 이 테이블에서만 회수합니다.
do $$
declare col record; pol record;
begin
  for col in select column_name from information_schema.columns
    where table_schema='public' and table_name='learning_notes' loop
    execute format('revoke all (%I) on table public.learning_notes from PUBLIC, anon, authenticated',col.column_name);
  end loop;
  -- permissive 정책은 OR로 결합되므로 기존 넓은 정책이 남지 않게 교체합니다.
  for pol in select policyname from pg_policies
    where schemaname='public' and tablename='learning_notes' loop
    execute format('drop policy %I on public.learning_notes',pol.policyname);
  end loop;
end $$;
grant SELECT, INSERT, UPDATE, DELETE on table public.learning_notes to authenticated;
create policy learning_notes_select_owner on public.learning_notes
  for SELECT to authenticated using ((select auth.uid()) = owner_id);
create policy learning_notes_insert_owner on public.learning_notes
  for INSERT to authenticated with check ((select auth.uid()) = owner_id);
create policy learning_notes_update_owner on public.learning_notes
  for UPDATE to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy learning_notes_delete_owner on public.learning_notes
  for DELETE to authenticated using ((select auth.uid()) = owner_id);
-- 역할 상속 등으로 예상 밖 실제 권한이 남으면 다른 역할/테이블을 변경하지 않고 전체 롤백합니다.
do $$
declare priv text;
begin
  foreach priv in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
    if has_table_privilege('anon','public.learning_notes',priv) then
      raise exception 'anon에 예상 밖 실제 권한이 있습니다: %',priv;
    end if;
    if has_table_privilege('authenticated','public.learning_notes',priv)
      is distinct from (priv = any(array['SELECT','INSERT','UPDATE','DELETE'])) then
      raise exception 'authenticated 실제 권한을 확인하세요: %',priv;
    end if;
  end loop;
end $$;
commit;

select 'after' as phase, grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema='public' and table_name='learning_notes'
and grantee in ('PUBLIC','anon','authenticated') order by grantee, privilege_type;
select 'after' as phase, r.role_name, p.privilege,
has_table_privilege(r.role_name,'public.learning_notes',p.privilege) as allowed
from (values ('anon'),('authenticated')) r(role_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege);
select relrowsecurity from pg_class where oid='public.learning_notes'::regclass;
select policyname, roles, cmd, qual, with_check from pg_policies
where schemaname='public' and tablename='learning_notes' order by policyname;
