-- 검토 후 SQL Editor에서 실행. learning_notes의 직접 자료 권한만 회수합니다.
select 'before' as phase, grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema='public' and table_name='learning_notes'
and grantee in ('PUBLIC','anon','authenticated') order by grantee, privilege_type;
select 'before' as phase, r.role_name, p.privilege,
has_table_privilege(r.role_name,'public.learning_notes',p.privilege) as allowed
from (values ('anon'),('authenticated'),('service_role')) r(role_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege);

begin;
revoke all on table public.learning_notes from PUBLIC, anon, authenticated;
do $$
declare col record; priv text; role_name text;
begin
  for col in select column_name from information_schema.columns
    where table_schema='public' and table_name='learning_notes' loop
    execute format('revoke all (%I) on table public.learning_notes from PUBLIC, anon, authenticated',col.column_name);
  end loop;
  foreach role_name in array array['anon','authenticated'] loop
    foreach priv in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      if has_table_privilege(role_name,'public.learning_notes',priv) then
        raise exception '직접 자료 권한이 남아 있습니다: % %',role_name,priv;
      end if;
    end loop;
  end loop;
  foreach priv in array array['SELECT','INSERT','UPDATE','DELETE'] loop
    if not has_table_privilege('service_role','public.learning_notes',priv) then
      raise exception '서버 역할의 기존 자료 권한을 확인하세요: %',priv;
    end if;
  end loop;
end;
$$;
-- 기존 RLS 정책, 소유자, 자료, Auth 및 다른 테이블은 변경하지 않습니다.
commit;

select 'after' as phase, grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema='public' and table_name='learning_notes'
and grantee in ('PUBLIC','anon','authenticated') order by grantee, privilege_type;
select 'after' as phase, r.role_name, p.privilege,
has_table_privilege(r.role_name,'public.learning_notes',p.privilege) as allowed
from (values ('anon'),('authenticated'),('service_role')) r(role_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege);
