-- Ritmo (habit tracker): cuentas con usuario + PIN, en el proyecto de Supabase "Futbol-pro".
-- Todo el acceso pasa por funciones SECURITY DEFINER; las tablas quedan cerradas (RLS sin políticas).
create table if not exists public.ritmo_users (
  username text primary key check (username ~ '^[a-z0-9._-]{3,30}$'),
  display_name text not null default '',
  pin_hash text not null,
  data jsonb not null default '{}'::jsonb,
  data_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  failed_attempts int not null default 0,
  locked_until timestamptz
);
comment on table public.ritmo_users is 'Ritmo: una fila por cuenta (usuario + hash bcrypt del PIN) con todos sus datos en jsonb.';

create table if not exists public.ritmo_sessions (
  token_hash text primary key,
  username text not null references public.ritmo_users(username) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists ritmo_sessions_username_idx on public.ritmo_sessions(username);
comment on table public.ritmo_sessions is 'Ritmo: sesiones abiertas por dispositivo (solo se guarda el SHA-256 del token).';

alter table public.ritmo_users enable row level security;
alter table public.ritmo_sessions enable row level security;
revoke all on public.ritmo_users, public.ritmo_sessions from anon, authenticated;

-- ---------- funciones internas (no expuestas) ----------
create or replace function public.ritmo_norm(p text) returns text
language sql immutable set search_path = '' as $$ select lower(btrim(coalesce(p, ''))) $$;

create or replace function public.ritmo_new_session(p_user text) returns text
language plpgsql security definer set search_path = 'public', 'extensions' as $$
declare t text := encode(gen_random_bytes(32), 'hex');
begin
  insert into ritmo_sessions(token_hash, username) values (encode(digest(t, 'sha256'), 'hex'), p_user);
  return t;
end $$;

create or replace function public.ritmo_check(p_user text, p_token text) returns text
language plpgsql security definer set search_path = 'public', 'extensions' as $$
declare u text := ritmo_norm(p_user);
begin
  update ritmo_sessions set last_seen_at = now()
   where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and username = u;
  if not found then raise exception 'sesion_invalida'; end if;
  return u;
end $$;

-- ---------- API pública ----------
create or replace function public.ritmo_signup(p_user text, p_pin text, p_name text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = 'public', 'extensions' as $$
declare u text := ritmo_norm(p_user); n text := left(btrim(coalesce(p_name, '')), 40); d jsonb := coalesce(p_data, '{}'::jsonb);
begin
  if u !~ '^[a-z0-9._-]{3,30}$' then raise exception 'usuario_invalido'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4,12}$' then raise exception 'pin_invalido'; end if;
  if exists (select 1 from ritmo_users where username = u) then raise exception 'usuario_existe'; end if;
  if pg_column_size(d) > 5000000 then raise exception 'datos_muy_grandes'; end if;
  insert into ritmo_users(username, display_name, pin_hash, data) values (u, n, crypt(p_pin, gen_salt('bf')), d);
  return jsonb_build_object('username', u, 'name', n, 'token', ritmo_new_session(u), 'data', d, 'updated_at', now());
end $$;

-- Los errores de PIN se devuelven (no se lanzan) para que el contador de intentos quede guardado.
create or replace function public.ritmo_login(p_user text, p_pin text)
returns jsonb language plpgsql security definer set search_path = 'public', 'extensions' as $$
declare u text := ritmo_norm(p_user); r ritmo_users;
begin
  select * into r from ritmo_users where username = u for update;
  if not found then return jsonb_build_object('error', 'login_invalido'); end if;
  if r.locked_until is not null and r.locked_until > now() then
    return jsonb_build_object('error', 'bloqueado', 'until', r.locked_until);
  end if;
  if r.pin_hash <> crypt(coalesce(p_pin, ''), r.pin_hash) then
    if r.failed_attempts + 1 >= 8 then
      update ritmo_users set failed_attempts = 0, locked_until = now() + interval '15 minutes' where username = u;
      return jsonb_build_object('error', 'bloqueado', 'until', now() + interval '15 minutes');
    end if;
    update ritmo_users set failed_attempts = failed_attempts + 1 where username = u;
    return jsonb_build_object('error', 'login_invalido');
  end if;
  update ritmo_users set failed_attempts = 0, locked_until = null where username = u;
  return jsonb_build_object('username', u, 'name', r.display_name, 'token', ritmo_new_session(u),
    'data', r.data, 'updated_at', r.data_updated_at);
end $$;

create or replace function public.ritmo_load(p_user text, p_token text)
returns jsonb language plpgsql security definer set search_path = 'public', 'extensions' as $$
declare u text := ritmo_check(p_user, p_token); r ritmo_users;
begin
  select * into r from ritmo_users where username = u;
  return jsonb_build_object('username', u, 'name', r.display_name, 'data', r.data, 'updated_at', r.data_updated_at);
end $$;

create or replace function public.ritmo_save(p_user text, p_token text, p_data jsonb)
returns timestamptz language plpgsql security definer set search_path = 'public', 'extensions' as $$
declare u text := ritmo_check(p_user, p_token); t timestamptz := clock_timestamp();
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'datos_invalidos'; end if;
  if pg_column_size(p_data) > 5000000 then raise exception 'datos_muy_grandes'; end if;
  update ritmo_users set data = p_data, data_updated_at = t where username = u;
  return t;
end $$;

create or replace function public.ritmo_change_pin(p_user text, p_token text, p_old text, p_new text)
returns void language plpgsql security definer set search_path = 'public', 'extensions' as $$
declare u text := ritmo_check(p_user, p_token); h text;
begin
  select pin_hash into h from ritmo_users where username = u;
  if h <> crypt(coalesce(p_old, ''), h) then raise exception 'pin_actual_incorrecto'; end if;
  if coalesce(p_new, '') !~ '^[0-9]{4,12}$' then raise exception 'pin_invalido'; end if;
  update ritmo_users set pin_hash = crypt(p_new, gen_salt('bf')) where username = u;
  -- cierra las demás sesiones abiertas con el PIN anterior
  delete from ritmo_sessions where username = u and token_hash <> encode(digest(p_token, 'sha256'), 'hex');
end $$;

create or replace function public.ritmo_set_name(p_user text, p_token text, p_name text)
returns void language plpgsql security definer set search_path = 'public', 'extensions' as $$
declare u text := ritmo_check(p_user, p_token);
begin
  update ritmo_users set display_name = left(btrim(coalesce(p_name, '')), 40) where username = u;
end $$;

create or replace function public.ritmo_logout(p_user text, p_token text)
returns void language plpgsql security definer set search_path = 'public', 'extensions' as $$
begin
  delete from ritmo_sessions where username = ritmo_norm(p_user)
    and token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
end $$;

create or replace function public.ritmo_delete_account(p_user text, p_token text, p_pin text)
returns void language plpgsql security definer set search_path = 'public', 'extensions' as $$
declare u text := ritmo_check(p_user, p_token); h text;
begin
  select pin_hash into h from ritmo_users where username = u;
  if h <> crypt(coalesce(p_pin, ''), h) then raise exception 'pin_actual_incorrecto'; end if;
  delete from ritmo_users where username = u;
end $$;

-- Permisos: solo la API pública es invocable desde la app
revoke all on function public.ritmo_norm(text), public.ritmo_new_session(text), public.ritmo_check(text, text) from public, anon, authenticated;
revoke all on function public.ritmo_signup(text, text, text, jsonb), public.ritmo_login(text, text), public.ritmo_load(text, text),
  public.ritmo_save(text, text, jsonb), public.ritmo_change_pin(text, text, text, text), public.ritmo_set_name(text, text, text),
  public.ritmo_logout(text, text), public.ritmo_delete_account(text, text, text) from public;
grant execute on function public.ritmo_signup(text, text, text, jsonb), public.ritmo_login(text, text), public.ritmo_load(text, text),
  public.ritmo_save(text, text, jsonb), public.ritmo_change_pin(text, text, text, text), public.ritmo_set_name(text, text, text),
  public.ritmo_logout(text, text), public.ritmo_delete_account(text, text, text) to anon, authenticated;
