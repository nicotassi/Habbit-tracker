-- Ritmo: avisos push con el celular bloqueado.
-- La app calcula con su propio motor qué avisar y cuándo (arranque, horarios, cierre) y sube esa
-- agenda cada vez que cambian los datos. Cada minuto pg_cron llama a la función "ritmo-push",
-- que manda lo que ya venció a todos los dispositivos suscriptos de esa cuenta.
-- Las claves (VAPID y el secreto del cron) se cargan aparte en ritmo_config y no están en este archivo.

create table if not exists public.ritmo_config (k text primary key, v text not null);

create table if not exists public.ritmo_push_subs (
  endpoint text primary key,
  username text not null references public.ritmo_users(username) on delete cascade,
  sub jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists ritmo_push_subs_user_idx on public.ritmo_push_subs(username);

create table if not exists public.ritmo_push_queue (
  username text not null references public.ritmo_users(username) on delete cascade,
  key text not null,
  at timestamptz not null,
  title text not null,
  body text not null default '',
  url text not null default '',
  sent_at timestamptz,
  primary key (username, key)
);
create index if not exists ritmo_push_queue_due_idx on public.ritmo_push_queue(at) where sent_at is null;

alter table public.ritmo_config enable row level security;
alter table public.ritmo_push_subs enable row level security;
alter table public.ritmo_push_queue enable row level security;
revoke all on public.ritmo_config, public.ritmo_push_subs, public.ritmo_push_queue from anon, authenticated;

create or replace function public.ritmo_vapid() returns text
language sql security definer set search_path = 'public' as $$ select v from ritmo_config where k = 'vapid_public' $$;

create or replace function public.ritmo_push_sub(p_user text, p_token text, p_sub jsonb) returns void
language plpgsql security definer set search_path = 'public', 'extensions' as $$
declare u text := ritmo_check(p_user, p_token); ep text := p_sub->>'endpoint';
begin
  if ep is null or ep !~ '^https://' or p_sub->'keys'->>'p256dh' is null then raise exception 'suscripcion_invalida'; end if;
  insert into ritmo_push_subs(endpoint, username, sub) values (ep, u, p_sub)
  on conflict (endpoint) do update set username = excluded.username, sub = excluded.sub;
  -- como mucho 10 dispositivos por cuenta
  delete from ritmo_push_subs where username = u and endpoint in (
    select endpoint from ritmo_push_subs where username = u order by created_at desc offset 10);
end $$;

create or replace function public.ritmo_push_unsub(p_user text, p_token text, p_endpoint text) returns void
language plpgsql security definer set search_path = 'public', 'extensions' as $$
declare u text := ritmo_check(p_user, p_token);
begin
  delete from ritmo_push_subs where username = u and endpoint = p_endpoint;
end $$;

-- Reemplaza la agenda pendiente. Lo que ya se mandó no se vuelve a agregar (misma clave).
create or replace function public.ritmo_push_plan(p_user text, p_token text, p_items jsonb) returns int
language plpgsql security definer set search_path = 'public', 'extensions' as $$
declare u text := ritmo_check(p_user, p_token); n int;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then raise exception 'agenda_invalida'; end if;
  delete from ritmo_push_queue where username = u and (sent_at is null or sent_at < now() - interval '3 days');
  insert into ritmo_push_queue(username, key, at, title, body, url)
  select u, left(i->>'key', 120), (i->>'at')::timestamptz, left(i->>'title', 120), left(coalesce(i->>'body', ''), 400), left(coalesce(i->>'url', ''), 120)
    from jsonb_array_elements(p_items) i
   where (i->>'at')::timestamptz > now() - interval '5 minutes' and (i->>'at')::timestamptz < now() + interval '9 days'
  on conflict (username, key) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Para la función del servidor: toma lo vencido (de los últimos 20 minutos) y lo marca como enviado.
create or replace function public.ritmo_push_take() returns table(username text, key text, title text, body text, url text, subs jsonb)
language plpgsql security definer set search_path = 'public' as $$
begin
  return query
  with due as (
    update ritmo_push_queue q set sent_at = now()
     where q.sent_at is null and q.at <= now() and q.at > now() - interval '20 minutes'
    returning q.username, q.key, q.title, q.body, q.url
  )
  select d.username, d.key, d.title, d.body, d.url,
         coalesce((select jsonb_agg(s.sub) from ritmo_push_subs s where s.username = d.username), '[]'::jsonb)
    from due d;
end $$;

revoke all on function public.ritmo_push_take() from public, anon, authenticated;
revoke all on function public.ritmo_vapid(), public.ritmo_push_sub(text, text, jsonb), public.ritmo_push_unsub(text, text, text),
  public.ritmo_push_plan(text, text, jsonb) from public;
grant execute on function public.ritmo_vapid(), public.ritmo_push_sub(text, text, jsonb), public.ritmo_push_unsub(text, text, text),
  public.ritmo_push_plan(text, text, jsonb) to anon, authenticated;

-- Cron: cada minuto llama a la función (el secreto se guarda en ritmo_config y se arma el job aparte):
--   create extension if not exists pg_net; create extension if not exists pg_cron;
--   select cron.schedule('ritmo-push', '* * * * *', $$select net.http_post(
--     url := 'https://qsijvmbhblestmrjhznw.supabase.co/functions/v1/ritmo-push',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-ritmo-cron', (select v from public.ritmo_config where k = 'cron_secret')),
--     body := '{}'::jsonb)$$);

-- Diagnóstico de la activación de avisos: cada intento guarda sus pasos (se borran a los 14 días).
create table if not exists public.ritmo_push_diag (
  id bigserial primary key,
  username text not null references public.ritmo_users(username) on delete cascade,
  attempt text not null,
  at timestamptz not null default now(),
  info jsonb not null
);
alter table public.ritmo_push_diag enable row level security;
revoke all on public.ritmo_push_diag from anon, authenticated;
create or replace function public.ritmo_push_diag(p_user text, p_token text, p_attempt text, p_info jsonb) returns void
language plpgsql security definer set search_path = 'public', 'extensions' as $$
declare u text := ritmo_check(p_user, p_token);
begin
  if pg_column_size(p_info) > 20000 then return; end if;
  insert into ritmo_push_diag(username, attempt, info) values (u, left(coalesce(p_attempt, ''), 40), p_info);
  delete from ritmo_push_diag where username = u and at < now() - interval '14 days';
end $$;
revoke all on function public.ritmo_push_diag(text, text, text, jsonb) from public;
grant execute on function public.ritmo_push_diag(text, text, text, jsonb) to anon, authenticated;
