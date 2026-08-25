-- ============================================================================
-- Cuadre Diario — inventario
--
-- El inventario es un SEGUNDO LIBRO con exactamente las mismas reglas que el
-- de la plata, y eso no es casualidad: es lo que permite que toda la
-- disciplina ya construida se aplique igual.
--
--   1. Solo existe un tipo de registro: el movimiento de inventario.
--   2. Las cantidades son siempre positivas; el signo lo pone el tipo.
--   3. Las existencias no se guardan: se calculan sumando movimientos.
--   4. Nada se borra: se anula, y el registro anulado sigue visible.
--   5. La merma es al inventario lo que el faltante es a la caja: una
--      pérdida real que debe quedar registrada y con motivo, no desaparecer.
-- ============================================================================

create type tipo_movimiento_inventario as enum (
  -- Entradas
  'compra', 'inventario_inicial', 'devolucion_cliente', 'ajuste_sobrante',
  -- Salidas
  'venta', 'devolucion_proveedor', 'ajuste_faltante', 'merma'
);

create type unidad_producto as enum ('unidad', 'libra', 'kilo', 'litro', 'paquete');

create or replace function es_entrada_inventario(t tipo_movimiento_inventario)
returns boolean
language sql
immutable
as $$
  select t in ('compra', 'inventario_inicial', 'devolucion_cliente', 'ajuste_sobrante');
$$;

-- ---------------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------------

create table productos (
  id            uuid primary key default gen_random_uuid(),
  propietario   uuid not null references auth.users (id) on delete cascade,
  nombre        text not null check (length(trim(nombre)) between 1 and 60),
  -- Código de barras o el que use el dueño. Opcional: la mayoría de lo que
  -- vende una tienda de barrio no tiene código.
  codigo        text check (codigo is null or length(trim(codigo)) between 1 and 40),
  unidad        unidad_producto not null default 'unidad',

  precio_venta  integer not null check (precio_venta >= 0),
  -- Último costo pagado. Se actualiza solo al registrar una compra.
  costo_actual  integer not null default 0 check (costo_actual >= 0),

  -- No todo se controla. Una tienda vende cientos de cosas y solo puede
  -- llevar cuenta real de unas pocas: las caras, las que se roban y las que
  -- se vencen. Un inventario a medias en el que se confía es peor que no
  -- tenerlo, así que esto es explícito y por producto.
  controla_stock boolean not null default true,
  stock_minimo  numeric(12,3) not null default 0 check (stock_minimo >= 0),

  -- Para el acceso rápido en la pantalla de venta.
  favorito      boolean not null default false,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),

  unique (propietario, nombre)
);

create unique index productos_codigo_unico
  on productos (propietario, codigo)
  where codigo is not null;

create index productos_activos_idx  on productos (propietario, activo, nombre);
create index productos_favoritos_idx on productos (propietario, favorito) where activo;

-- ---------------------------------------------------------------------------
-- Movimientos de inventario
-- ---------------------------------------------------------------------------

create table movimientos_inventario (
  id            uuid primary key default gen_random_uuid(),
  propietario   uuid not null references auth.users (id) on delete cascade,
  producto_id   uuid not null references productos (id),
  sesion_id     uuid not null references sesiones_caja (id),
  tipo          tipo_movimiento_inventario not null,

  -- Con decimales: una tienda vende media libra de queso. El dinero sigue
  -- siendo entero; solo las cantidades admiten fracción.
  cantidad      numeric(12,3) not null check (cantidad > 0),

  -- Congelados en el momento del movimiento. Si mañana sube el precio del
  -- proveedor, el margen de la venta de hoy no puede cambiar solo: el
  -- historial tiene que seguir contando lo que realmente pasó.
  costo_unitario  integer not null default 0 check (costo_unitario >= 0),
  precio_unitario integer not null default 0 check (precio_unitario >= 0),

  -- El movimiento de plata que lo originó, si lo hubo. Permite ir de una
  -- venta a los productos que salieron, y al revés.
  movimiento_id uuid references movimientos (id),

  nota          text check (nota is null or length(nota) <= 500),
  estado        estado_movimiento not null default 'vigente',
  creado_en     timestamptz not null default now(),
  anulado_en    timestamptz,
  motivo_anulacion text,

  constraint anulacion_coherente_inv check (
    (estado = 'vigente' and anulado_en is null and motivo_anulacion is null)
    or
    (estado = 'anulado' and anulado_en is not null
     and motivo_anulacion is not null and length(trim(motivo_anulacion)) > 0)
  )
);

create index mov_inv_producto_idx  on movimientos_inventario (propietario, producto_id) where estado = 'vigente';
create index mov_inv_sesion_idx    on movimientos_inventario (propietario, sesion_id, creado_en desc);
create index mov_inv_movimiento_idx on movimientos_inventario (movimiento_id) where movimiento_id is not null;

-- ---------------------------------------------------------------------------
-- Integridad
-- ---------------------------------------------------------------------------

create or replace function validar_movimiento_inventario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  estado_de_la_sesion estado_sesion;
  dueno_sesion   uuid;
  dueno_producto uuid;
  dueno_mov      uuid;
begin
  select estado, propietario into estado_de_la_sesion, dueno_sesion
    from sesiones_caja where id = new.sesion_id;

  if dueno_sesion is null or dueno_sesion <> new.propietario then
    raise exception 'La sesión de caja no existe o no es tuya';
  end if;

  select propietario into dueno_producto from productos where id = new.producto_id;
  if dueno_producto is null or dueno_producto <> new.propietario then
    raise exception 'El producto no existe o no es tuyo';
  end if;

  if new.movimiento_id is not null then
    select propietario into dueno_mov from movimientos where id = new.movimiento_id;
    if dueno_mov is null or dueno_mov <> new.propietario then
      raise exception 'El movimiento de plata no existe o no es tuyo';
    end if;
  end if;

  if tg_op = 'INSERT' and estado_de_la_sesion = 'cerrada' then
    raise exception 'La caja de ese día ya está cerrada: registra el ajuste en la caja de hoy';
  end if;

  return new;
end;
$$;

create trigger mov_inv_validar
  before insert or update on movimientos_inventario
  for each row execute function validar_movimiento_inventario();

-- Igual que en la plata: un movimiento no se edita, se anula.
create or replace function proteger_movimiento_inventario()
returns trigger
language plpgsql
as $$
begin
  if old.estado = 'anulado' then
    raise exception 'Un movimiento anulado no se puede modificar';
  end if;

  if new.tipo <> old.tipo
     or new.cantidad <> old.cantidad
     or new.producto_id <> old.producto_id
     or new.sesion_id <> old.sesion_id
     or new.creado_en <> old.creado_en then
    raise exception 'Un movimiento de inventario no se edita: anúlalo y registra el correcto';
  end if;

  return new;
end;
$$;

create trigger mov_inv_proteger
  before update on movimientos_inventario
  for each row execute function proteger_movimiento_inventario();

-- Al comprar, el costo del producto se actualiza solo. Si se hiciera a mano
-- nadie lo haría, y un costo desactualizado convierte el margen en ficción.
create or replace function actualizar_costo_producto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'compra' and new.costo_unitario > 0 then
    update productos
       set costo_actual = new.costo_unitario
     where id = new.producto_id;
  end if;
  return new;
end;
$$;

create trigger mov_inv_actualizar_costo
  after insert on movimientos_inventario
  for each row execute function actualizar_costo_producto();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table productos              enable row level security;
alter table movimientos_inventario enable row level security;

create policy propias_select on productos for select using (propietario = auth.uid());
create policy propias_insert on productos for insert with check (propietario = auth.uid());
create policy propias_update on productos for update using (propietario = auth.uid()) with check (propietario = auth.uid());

create policy propias_select on movimientos_inventario for select using (propietario = auth.uid());
create policy propias_insert on movimientos_inventario for insert with check (propietario = auth.uid());
create policy propias_update on movimientos_inventario for update using (propietario = auth.uid()) with check (propietario = auth.uid());

-- ---------------------------------------------------------------------------
-- Existencias: se calculan, no se guardan
-- ---------------------------------------------------------------------------

-- Mismo principio que los saldos de plata. Un stock guardado tarde o
-- temprano alguien lo «arregla» y se pierde el rastro de qué faltó.
create or replace view existencias
with (security_invoker = true)
as
select
  p.propietario,
  p.id              as producto_id,
  p.nombre,
  p.unidad,
  p.precio_venta,
  p.costo_actual,
  p.controla_stock,
  p.stock_minimo,
  p.favorito,
  coalesce(sum(
    case when es_entrada_inventario(m.tipo) then m.cantidad else -m.cantidad end
  ), 0)::numeric(14,3) as cantidad,
  -- Cuánta plata hay parada en esa estantería, al último costo pagado.
  (coalesce(sum(
    case when es_entrada_inventario(m.tipo) then m.cantidad else -m.cantidad end
  ), 0) * p.costo_actual)::bigint as valor_al_costo
from productos p
left join movimientos_inventario m
  on m.producto_id = p.id
 and m.estado = 'vigente'
where p.activo
group by p.propietario, p.id, p.nombre, p.unidad, p.precio_venta,
         p.costo_actual, p.controla_stock, p.stock_minimo, p.favorito;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

grant select, insert, update on productos              to authenticated;
grant select, insert, update on movimientos_inventario to authenticated;
grant select on existencias to authenticated;
