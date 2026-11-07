-- =====================================================================
-- INVENTARIO Y PRÉSTAMOS - Registro de Copias (I.E. 0773)
-- Ejecutar UNA SOLA VEZ en Supabase > SQL Editor.
-- Requiere que ya exista la tabla public.perfiles (id, rol, nombre).
--
-- Permisos:
--   admin     -> puede ver y modificar todo
--   directivo -> solo puede VER (inventario, préstamos e historial)
--   docente   -> no ve nada de esto
-- La restricción vive en la base de datos: aunque alguien manipule la
-- página, una cuenta de solo lectura NO puede modificar datos.
-- =====================================================================

-- ---------- Funciones de rol ----------
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

create or replace function public.es_lector() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol in ('admin','directivo'));
$$;

-- ---------- Tablas ----------
create table if not exists public.bienes (
  id              text primary key,                 -- JEC-0001
  denominacion    text not null,
  marca           text default '',
  modelo          text default '',
  caracteristicas text default '',
  color           text default '',
  serie           text default '',
  categoria       text not null,
  estado          text not null default 'Bueno',    -- Bueno / Regular / Malo / Baja
  cantidad        integer,                          -- NULL = unidad; N = lote (ej. 22 calculadoras)
  baja            boolean not null default false,
  baja_motivo     text,
  baja_obs        text,
  baja_fecha      date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint bienes_cantidad_ok check (cantidad is null or cantidad > 1)
);

-- No permite dos bienes con la misma serie.
create unique index if not exists bienes_serie_unica
  on public.bienes (lower(serie)) where serie is not null and serie <> '';

create table if not exists public.prestamos (
  id               uuid primary key default gen_random_uuid(),
  fecha            date not null default (now() at time zone 'America/Lima')::date,
  hora_salida      text not null,
  hora_devolucion  text,
  docente          text not null,
  aula             text default '',
  estado           text not null default 'prestado'
                   check (estado in ('prestado','devuelto','anulado')),
  observacion      text default '',
  creado_por       uuid default auth.uid(),
  created_at       timestamptz not null default now()
);

create table if not exists public.prestamo_items (
  id           bigserial primary key,
  prestamo_id  uuid not null references public.prestamos(id) on delete cascade,
  bien_id      text not null references public.bienes(id),
  cantidad     integer not null default 1 check (cantidad > 0)
);
create index if not exists prestamo_items_prestamo on public.prestamo_items(prestamo_id);
create index if not exists prestamo_items_bien on public.prestamo_items(bien_id);

create table if not exists public.historial_bienes (
  id             bigserial primary key,
  bien_id        text,
  accion         text not null,      -- alta, edicion, baja, reactivacion, prestamo, devolucion, anulacion
  detalle        jsonb,
  usuario_id     uuid,
  usuario_nombre text,
  created_at     timestamptz not null default now()
);
create index if not exists historial_bien on public.historial_bienes(bien_id, created_at desc);

-- ---------- Seguridad (RLS) ----------
alter table public.bienes           enable row level security;
alter table public.prestamos        enable row level security;
alter table public.prestamo_items   enable row level security;
alter table public.historial_bienes enable row level security;

drop policy if exists bienes_select on public.bienes;
drop policy if exists bienes_insert on public.bienes;
drop policy if exists bienes_update on public.bienes;
create policy bienes_select on public.bienes for select using (public.es_lector());
create policy bienes_insert on public.bienes for insert with check (public.es_admin());
create policy bienes_update on public.bienes for update using (public.es_admin()) with check (public.es_admin());
-- Sin política de DELETE: ningún bien se borra, solo se da de baja.

drop policy if exists prestamos_select on public.prestamos;
create policy prestamos_select on public.prestamos for select using (public.es_lector());
-- Los préstamos se crean/modifican SOLO con las funciones de abajo (admin).

drop policy if exists items_select on public.prestamo_items;
create policy items_select on public.prestamo_items for select using (public.es_lector());

drop policy if exists historial_select on public.historial_bienes;
create policy historial_select on public.historial_bienes for select using (public.es_lector());
-- Sin políticas de INSERT/UPDATE/DELETE: el historial solo lo escriben los
-- disparadores y nadie puede borrarlo ni alterarlo desde la aplicación.

-- ---------- Historial automático de bienes ----------
create or replace function public.log_bienes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nombre text;
  v_accion text;
  v_det jsonb;
begin
  select coalesce(nombre, '') into v_nombre from public.perfiles where id = auth.uid();

  if tg_op = 'INSERT' then
    insert into public.historial_bienes(bien_id, accion, detalle, usuario_id, usuario_nombre)
    values (new.id, 'alta', jsonb_build_object('denominacion', new.denominacion, 'cantidad', new.cantidad), auth.uid(), v_nombre);
    return new;
  elsif tg_op = 'UPDATE' then
    new.updated_at := now();
    select jsonb_object_agg(n.key, jsonb_build_object('antes', o.value, 'despues', n.value))
      into v_det
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value and n.key <> 'updated_at';
    if v_det is null then return new; end if;
    v_accion := case
      when old.baja = false and new.baja = true  then 'baja'
      when old.baja = true  and new.baja = false then 'reactivacion'
      else 'edicion' end;
    insert into public.historial_bienes(bien_id, accion, detalle, usuario_id, usuario_nombre)
    values (new.id, v_accion, v_det, auth.uid(), v_nombre);
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.historial_bienes(bien_id, accion, detalle, usuario_id, usuario_nombre)
    values (old.id, 'eliminacion', to_jsonb(old), auth.uid(), v_nombre);
    return old;
  end if;
  return null;
end $$;

drop trigger if exists trg_log_bienes on public.bienes;
create trigger trg_log_bienes before insert or update or delete on public.bienes
  for each row execute function public.log_bienes();

-- ---------- Validación de stock al prestar ----------
create or replace function public.validar_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_total int; v_baja boolean; v_usado int;
begin
  select coalesce(cantidad, 1), baja into v_total, v_baja from public.bienes where id = new.bien_id;
  if not found then raise exception 'El bien % no existe', new.bien_id; end if;
  if v_baja then raise exception 'El bien % está dado de baja', new.bien_id; end if;
  select coalesce(sum(pi.cantidad), 0) into v_usado
    from public.prestamo_items pi join public.prestamos p on p.id = pi.prestamo_id
   where pi.bien_id = new.bien_id and p.estado = 'prestado';
  if v_usado + new.cantidad > v_total then
    raise exception 'No hay suficientes unidades disponibles de % (quedan %)', new.bien_id, v_total - v_usado;
  end if;
  return new;
end $$;

drop trigger if exists trg_validar_stock on public.prestamo_items;
create trigger trg_validar_stock before insert on public.prestamo_items
  for each row execute function public.validar_stock();

-- ---------- Funciones de préstamos (solo admin) ----------
-- p_items = [{"bien_id":"JEC-0001","cantidad":1}, ...]
create or replace function public.registrar_prestamo(
  p_docente text, p_aula text, p_hora text, p_obs text, p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_item jsonb; v_nombre text;
begin
  if not public.es_admin() then raise exception 'Sin permiso'; end if;
  if coalesce(trim(p_docente), '') = '' then raise exception 'Falta el docente'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Agrega al menos un bien'; end if;
  select coalesce(nombre, '') into v_nombre from public.perfiles where id = auth.uid();

  insert into public.prestamos(docente, aula, hora_salida, observacion)
  values (trim(p_docente), coalesce(p_aula, ''),
          coalesce(nullif(p_hora, ''), to_char(now() at time zone 'America/Lima', 'HH24:MI')),
          coalesce(p_obs, ''))
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.prestamo_items(prestamo_id, bien_id, cantidad)
    values (v_id, v_item->>'bien_id', greatest(coalesce((v_item->>'cantidad')::int, 1), 1));
    insert into public.historial_bienes(bien_id, accion, detalle, usuario_id, usuario_nombre)
    values (v_item->>'bien_id', 'prestamo',
            jsonb_build_object('docente', trim(p_docente), 'aula', p_aula, 'cantidad', coalesce((v_item->>'cantidad')::int, 1)),
            auth.uid(), v_nombre);
  end loop;
  return v_id;
end $$;

create or replace function public.devolver_prestamo(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_nombre text; r record;
begin
  if not public.es_admin() then raise exception 'Sin permiso'; end if;
  select coalesce(nombre, '') into v_nombre from public.perfiles where id = auth.uid();
  update public.prestamos
     set estado = 'devuelto', hora_devolucion = to_char(now() at time zone 'America/Lima', 'HH24:MI')
   where id = p_id and estado = 'prestado';
  if not found then raise exception 'El préstamo no está pendiente'; end if;
  for r in select bien_id, cantidad from public.prestamo_items where prestamo_id = p_id loop
    insert into public.historial_bienes(bien_id, accion, detalle, usuario_id, usuario_nombre)
    values (r.bien_id, 'devolucion', jsonb_build_object('cantidad', r.cantidad), auth.uid(), v_nombre);
  end loop;
end $$;

create or replace function public.anular_prestamo(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_nombre text; r record;
begin
  if not public.es_admin() then raise exception 'Sin permiso'; end if;
  select coalesce(nombre, '') into v_nombre from public.perfiles where id = auth.uid();
  update public.prestamos set estado = 'anulado' where id = p_id and estado = 'prestado';
  if not found then raise exception 'Solo se anulan préstamos pendientes'; end if;
  for r in select bien_id from public.prestamo_items where prestamo_id = p_id loop
    insert into public.historial_bienes(bien_id, accion, detalle, usuario_id, usuario_nombre)
    values (r.bien_id, 'anulacion', jsonb_build_object('motivo', 'Préstamo anulado por error'), auth.uid(), v_nombre);
  end loop;
end $$;

grant execute on function public.es_admin()  to authenticated;
grant execute on function public.es_lector() to authenticated;
grant execute on function public.registrar_prestamo(text, text, text, text, jsonb) to authenticated;
grant execute on function public.devolver_prestamo(uuid) to authenticated;
grant execute on function public.anular_prestamo(uuid)   to authenticated;
