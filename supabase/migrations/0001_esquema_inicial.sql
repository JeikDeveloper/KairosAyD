-- ============================================================================
-- Cuadre Diario — esquema inicial
--
-- Principios que el esquema hace cumplir, para que no dependan de la interfaz:
--   1. Todo registro pertenece a un dueño (`propietario`) y RLS lo aísla.
--   2. Sin sesión de caja abierta no se puede registrar un movimiento.
--   3. Los montos son enteros positivos; el signo lo pone el tipo.
--   4. Nada se borra: se anula. No hay DELETE permitido para el usuario.
--   5. Una sesión cerrada queda inmutable, incluida su lista de movimientos.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type tipo_movimiento as enum (
  'venta', 'aporte', 'traslado_entrada', 'ajuste_sobrante',
  'gasto', 'compra', 'retiro', 'traslado_salida', 'ajuste_faltante'
);

create type estado_movimiento as enum ('vigente', 'anulado');
create type estado_sesion     as enum ('abierta', 'cerrada');
create type clase_billetera   as enum ('efectivo', 'digital');
create type direccion_categoria as enum ('entrada', 'salida');

-- Qué tipos suman al saldo. Vive en la base para que ningún cliente pueda
-- inventarse un signo distinto al de la aplicación.
create or replace function es_entrada(t tipo_movimiento)
returns boolean
language sql
immutable
as $$
  select t in ('venta', 'aporte', 'traslado_entrada', 'ajuste_sobrante');
$$;

-- ---------------------------------------------------------------------------
-- Billeteras
-- ---------------------------------------------------------------------------

create table billeteras (
  id           uuid primary key default gen_random_uuid(),
  propietario  uuid not null references auth.users (id) on delete cascade,
  nombre       text not null check (length(trim(nombre)) between 1 and 40),
  clase        clase_billetera not null,
  -- Cuenta compartida con el uso personal: no se le exige cuadre exacto.
  mezclada     boolean not null default false,
  activa       boolean not null default true,
  orden        smallint not null default 0,
  creada_en    timestamptz not null default now(),

  unique (propietario, nombre)
);

create index billeteras_propietario_idx on billeteras (propietario, activa, orden);

-- ---------------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------------

create table categorias (
  id           uuid primary key default gen_random_uuid(),
  propietario  uuid not null references auth.users (id) on delete cascade,
  nombre       text not null check (length(trim(nombre)) between 1 and 40),
  -- Las categorías de gasto no sirven para clasificar ventas y viceversa.
  aplica_a     direccion_categoria not null,
  activa       boolean not null default true,
  creada_en    timestamptz not null default now(),

  unique (propietario, nombre, aplica_a)
);

create index categorias_propietario_idx on categorias (propietario, aplica_a, activa);

-- ---------------------------------------------------------------------------
-- Ajustes del negocio
-- ---------------------------------------------------------------------------

create table ajustes_negocio (
  propietario        uuid primary key references auth.users (id) on delete cascade,
  nombre_negocio     text not null default 'Mi tienda',
  -- Diferencia que se considera sencillo o redondeo y no vale investigar.
  umbral_diferencia  integer not null default 2000 check (umbral_diferencia >= 0),
  horas_para_aviso   smallint not null default 20 check (horas_para_aviso between 8 and 48),
  actualizado_en     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sesiones de caja
-- ---------------------------------------------------------------------------

create table sesiones_caja (
  id                uuid primary key default gen_random_uuid(),
  propietario       uuid not null references auth.users (id) on delete cascade,
  -- El día del negocio, no el del reloj: una tienda que cierra a las 12:30
  -- a.m. sigue en el día anterior hasta que cierre la caja.
  fecha_operativa   date not null,
  estado            estado_sesion not null default 'abierta',
  abierta_en        timestamptz not null default now(),
  cerrada_en        timestamptz,
  -- Efectivo contado al abrir, a ciegas.
  conteo_apertura   integer not null check (conteo_apertura >= 0),
  -- Efectivo que se deja para mañana. El resto sale como retiro.
  base_siguiente    integer check (base_siguiente >= 0),
  nota_cierre       text,

  constraint cierre_coherente check (
    (estado = 'abierta' and cerrada_en is null and base_siguiente is null)
    or
    (estado = 'cerrada' and cerrada_en is not null and base_siguiente is not null)
  )
);

-- Una sola caja abierta a la vez. Sin esto, dos pestañas del navegador
-- podrían abrir dos cajas y los movimientos se repartirían entre ambas.
create unique index sesion_abierta_unica
  on sesiones_caja (propietario)
  where estado = 'abierta';

create index sesiones_fecha_idx on sesiones_caja (propietario, fecha_operativa desc);

-- ---------------------------------------------------------------------------
-- Movimientos
-- ---------------------------------------------------------------------------

create table movimientos (
  id            uuid primary key default gen_random_uuid(),
  propietario   uuid not null references auth.users (id) on delete cascade,
  -- Sin caja abierta no hay movimiento: la regla vive aquí, no en la interfaz.
  sesion_id     uuid not null references sesiones_caja (id),
  tipo          tipo_movimiento not null,
  -- Siempre positivo. El signo lo pone el tipo, nunca el monto.
  monto         integer not null check (monto > 0 and monto <= 1000000000),
  billetera_id  uuid not null references billeteras (id),
  categoria_id  uuid references categorias (id),
  nota          text check (nota is null or length(nota) <= 500),
  estado        estado_movimiento not null default 'vigente',
  -- Agrupa las dos patas de un traslado.
  grupo_id      uuid,
  -- Movimiento que este ajuste corrige.
  corrige_a     uuid references movimientos (id),
  creado_en     timestamptz not null default now(),
  anulado_en    timestamptz,
  motivo_anulacion text,

  constraint anulacion_coherente check (
    (estado = 'vigente' and anulado_en is null and motivo_anulacion is null)
    or
    (estado = 'anulado' and anulado_en is not null
     and motivo_anulacion is not null and length(trim(motivo_anulacion)) > 0)
  )
);

create index movimientos_sesion_idx     on movimientos (propietario, sesion_id, creado_en desc);
create index movimientos_billetera_idx  on movimientos (propietario, billetera_id) where estado = 'vigente';
create index movimientos_recientes_idx  on movimientos (propietario, creado_en desc);
create index movimientos_grupo_idx      on movimientos (grupo_id) where grupo_id is not null;

-- ---------------------------------------------------------------------------
-- Conteos del arqueo (lo que el dueño contó, contra lo que la app esperaba)
-- ---------------------------------------------------------------------------

create table conteos_arqueo (
  id            uuid primary key default gen_random_uuid(),
  propietario   uuid not null references auth.users (id) on delete cascade,
  sesion_id     uuid not null references sesiones_caja (id) on delete cascade,
  billetera_id  uuid not null references billeteras (id),
  -- Se guardan los dos: el esperado queda congelado tal como estaba al
  -- cerrar, para que el historial no cambie si después se anula algo.
  esperado      integer not null,
  contado       integer not null check (contado >= 0),
  diferencia    integer not null,
  motivo        text,
  nota          text,
  creado_en     timestamptz not null default now(),

  unique (sesion_id, billetera_id),
  constraint diferencia_calculada check (diferencia = contado - esperado),
  -- No se puede cerrar con diferencia y sin explicación. «No sé qué pasó»
  -- es un motivo válido; el silencio no.
  constraint diferencia_explicada check (
    diferencia = 0 or (motivo is not null and length(trim(motivo)) > 0)
  )
);

create index conteos_sesion_idx on conteos_arqueo (propietario, sesion_id);

-- ---------------------------------------------------------------------------
-- Integridad: coherencia entre tablas
-- ---------------------------------------------------------------------------

-- Un movimiento no puede apuntar a la sesión, la billetera o la categoría
-- de otro dueño. Sin esto, un id filtrado permitiría escribir en datos ajenos.
create or replace function validar_movimiento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  estado_de_la_sesion estado_sesion;
  dueno_sesion    uuid;
  dueno_billetera uuid;
  dueno_categoria uuid;
begin
  select estado, propietario into estado_de_la_sesion, dueno_sesion
    from sesiones_caja where id = new.sesion_id;

  if dueno_sesion is null or dueno_sesion <> new.propietario then
    raise exception 'La sesión de caja no existe o no es tuya';
  end if;

  select propietario into dueno_billetera from billeteras where id = new.billetera_id;
  if dueno_billetera is null or dueno_billetera <> new.propietario then
    raise exception 'La billetera no existe o no es tuya';
  end if;

  if new.categoria_id is not null then
    select propietario into dueno_categoria from categorias where id = new.categoria_id;
    if dueno_categoria is null or dueno_categoria <> new.propietario then
      raise exception 'La categoría no existe o no es tuya';
    end if;
  end if;

  -- Un día cerrado queda cerrado. Las correcciones se hacen con un
  -- movimiento de ajuste con fecha de hoy, no editando el pasado.
  if tg_op = 'INSERT' and estado_de_la_sesion = 'cerrada' then
    raise exception 'La caja de ese día ya está cerrada: registra un ajuste en la caja de hoy';
  end if;

  return new;
end;
$$;

create trigger movimientos_validar
  before insert or update on movimientos
  for each row execute function validar_movimiento();

-- Un movimiento vigente solo puede cambiar para anularse. Ni el monto, ni la
-- billetera, ni el tipo se editan: eso es lo que hace auditable el historial.
create or replace function proteger_movimiento()
returns trigger
language plpgsql
as $$
begin
  if old.estado = 'anulado' then
    raise exception 'Un movimiento anulado no se puede modificar';
  end if;

  if new.tipo <> old.tipo
     or new.monto <> old.monto
     or new.billetera_id <> old.billetera_id
     or new.sesion_id <> old.sesion_id
     or new.creado_en <> old.creado_en then
    raise exception 'Un movimiento no se edita: anúlalo y registra el correcto';
  end if;

  return new;
end;
$$;

create trigger movimientos_proteger
  before update on movimientos
  for each row execute function proteger_movimiento();

-- Una sesión cerrada no se reabre por accidente ni cambia sus cifras.
create or replace function proteger_sesion()
returns trigger
language plpgsql
as $$
begin
  if old.estado = 'cerrada' then
    raise exception 'El día ya está cerrado';
  end if;
  return new;
end;
$$;

create trigger sesiones_proteger
  before update on sesiones_caja
  for each row execute function proteger_sesion();

-- ---------------------------------------------------------------------------
-- RLS: cada dueño solo ve lo suyo
-- ---------------------------------------------------------------------------

alter table billeteras      enable row level security;
alter table categorias      enable row level security;
alter table ajustes_negocio enable row level security;
alter table sesiones_caja   enable row level security;
alter table movimientos     enable row level security;
alter table conteos_arqueo  enable row level security;

-- Lectura, inserción y actualización propias. Ningún DELETE: nada se borra.
create policy propias_select on billeteras      for select using (propietario = auth.uid());
create policy propias_insert on billeteras      for insert with check (propietario = auth.uid());
create policy propias_update on billeteras      for update using (propietario = auth.uid()) with check (propietario = auth.uid());

create policy propias_select on categorias      for select using (propietario = auth.uid());
create policy propias_insert on categorias      for insert with check (propietario = auth.uid());
create policy propias_update on categorias      for update using (propietario = auth.uid()) with check (propietario = auth.uid());

create policy propias_select on ajustes_negocio for select using (propietario = auth.uid());
create policy propias_insert on ajustes_negocio for insert with check (propietario = auth.uid());
create policy propias_update on ajustes_negocio for update using (propietario = auth.uid()) with check (propietario = auth.uid());

create policy propias_select on sesiones_caja   for select using (propietario = auth.uid());
create policy propias_insert on sesiones_caja   for insert with check (propietario = auth.uid());
create policy propias_update on sesiones_caja   for update using (propietario = auth.uid()) with check (propietario = auth.uid());

create policy propias_select on movimientos     for select using (propietario = auth.uid());
create policy propias_insert on movimientos     for insert with check (propietario = auth.uid());
create policy propias_update on movimientos     for update using (propietario = auth.uid()) with check (propietario = auth.uid());

create policy propias_select on conteos_arqueo  for select using (propietario = auth.uid());
create policy propias_insert on conteos_arqueo  for insert with check (propietario = auth.uid());

-- ---------------------------------------------------------------------------
-- Permisos explícitos sobre la API
-- ---------------------------------------------------------------------------
--
-- El proyecto se crea con «exponer tablas nuevas automáticamente» apagado,
-- así que ninguna tabla es alcanzable por la API hasta que se le dé permiso
-- aquí. Es una segunda barrera detrás de RLS: si algún día se agrega una
-- tabla y se olvida su política, no queda expuesta por descuido.
--
-- Solo `authenticated`. A `anon` no se le da nada: todas las políticas se
-- apoyan en `auth.uid()`, que sin sesión es nulo, así que un permiso para
-- anónimos no serviría para nada y sí ampliaría la superficie.

grant usage on schema public to authenticated;

-- Lectura, alta y modificación. DELETE en ninguna tabla: nada se borra.
grant select, insert, update on billeteras      to authenticated;
grant select, insert, update on categorias      to authenticated;
grant select, insert, update on ajustes_negocio to authenticated;
grant select, insert, update on sesiones_caja   to authenticated;
grant select, insert, update on movimientos     to authenticated;

-- El arqueo se congela al cerrar: se escribe una vez y no se modifica.
grant select, insert on conteos_arqueo to authenticated;

-- La vista de saldos hereda RLS de las tablas (`security_invoker = true`).
grant select on saldos_por_billetera to authenticated;

-- ---------------------------------------------------------------------------
-- Saldos: se calculan, no se guardan
-- ---------------------------------------------------------------------------

-- Un saldo guardado tarde o temprano alguien lo «arregla» y se pierde el
-- rastro. Calculado, un saldo equivocado siempre tiene detrás un movimiento
-- equivocado, y se puede encontrar.
create or replace view saldos_por_billetera
with (security_invoker = true)
as
select
  b.propietario,
  b.id            as billetera_id,
  b.nombre,
  b.clase,
  b.mezclada,
  b.orden,
  coalesce(sum(
    case when es_entrada(m.tipo) then m.monto else -m.monto end
  ), 0)::bigint   as saldo
from billeteras b
left join movimientos m
  on m.billetera_id = b.id
 and m.estado = 'vigente'
where b.activa
group by b.propietario, b.id, b.nombre, b.clase, b.mezclada, b.orden;

-- ---------------------------------------------------------------------------
-- Semilla: lo mínimo para que la app sirva desde el primer minuto
-- ---------------------------------------------------------------------------

create or replace function sembrar_negocio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into ajustes_negocio (propietario) values (new.id);

  insert into billeteras (propietario, nombre, clase, orden) values
    (new.id, 'Efectivo',      'efectivo', 1),
    (new.id, 'Nequi',         'digital',  2),
    (new.id, 'Daviplata',     'digital',  3),
    (new.id, 'Transferencia', 'digital',  4);

  insert into categorias (propietario, nombre, aplica_a) values
    (new.id, 'Arriendo',      'salida'),
    (new.id, 'Servicios',     'salida'),
    (new.id, 'Mercancía',     'salida'),
    (new.id, 'Transporte',    'salida'),
    (new.id, 'Empaques',      'salida'),
    (new.id, 'Otros gastos',  'salida'),
    (new.id, 'Mostrador',     'entrada'),
    (new.id, 'Recargas',      'entrada'),
    (new.id, 'Otros ingresos','entrada');

  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function sembrar_negocio();
