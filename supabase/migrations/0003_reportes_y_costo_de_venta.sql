-- ============================================================================
-- Cuadre Diario — costo congelado en la venta y vistas de reportes
--
-- Dos correcciones, ambas de exactitud del dato:
--
--  1. La venta no guardaba el costo del producto, así que la ganancia real
--     habría dado siempre cero. Ahora lo congela un disparador, no la app:
--     si dependiera de que el cliente lo mande, tarde o temprano una ruta
--     nueva se olvidaría y el margen quedaría mal en silencio.
--
--  2. Los reportes sumaban en el navegador trayendo los movimientos del mes,
--     y la API corta en 1000 filas. Una tienda con 50 ventas diarias pasa
--     ese límite en tres semanas y los totales del mes saldrían cortos, sin
--     ningún error visible. Postgres agrupa sin ese límite.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1 · Congelar el costo en cada salida de mercancía
-- ---------------------------------------------------------------------------

-- El costo se copia en el momento del movimiento. Si mañana el proveedor
-- sube el precio, el margen de la venta de hoy no puede cambiar solo: el
-- historial tiene que seguir contando lo que realmente pasó.
create or replace function congelar_costo_de_salida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_entrada_inventario(new.tipo) and new.costo_unitario = 0 then
    select costo_actual into new.costo_unitario
      from productos where id = new.producto_id;
    new.costo_unitario := coalesce(new.costo_unitario, 0);
  end if;
  return new;
end;
$$;

create trigger mov_inv_congelar_costo
  before insert on movimientos_inventario
  for each row execute function congelar_costo_de_salida();

-- ---------------------------------------------------------------------------
-- 2 · Vistas de reportes: se agrupa en la base, no en el teléfono
-- ---------------------------------------------------------------------------

/*
 * Entró, salió y neto por día operativo.
 *
 * Excluye traslados y ajustes por la misma razón que `resumirPeriodo` en el
 * dominio: mover plata de Nequi al cajón no es un ingreso, y un ajuste de
 * arqueo es una corrección de saldo, no plata que entró al negocio.
 */
create or replace view resumen_por_dia
with (security_invoker = true)
as
select
  s.propietario,
  s.fecha_operativa,
  coalesce(sum(case when es_entrada(m.tipo) then m.monto else 0 end), 0)::bigint as entro,
  coalesce(sum(case when es_entrada(m.tipo) then 0 else m.monto end), 0)::bigint as salio,
  coalesce(sum(
    case when es_entrada(m.tipo) then m.monto else -m.monto end
  ), 0)::bigint as neto,
  count(m.id)::int as cantidad
from sesiones_caja s
left join movimientos m
  on m.sesion_id = s.id
 and m.estado = 'vigente'
 and m.tipo not in ('traslado_entrada', 'traslado_salida',
                    'ajuste_sobrante', 'ajuste_faltante')
group by s.propietario, s.fecha_operativa;

/** Gastos y compras agrupados por categoría y día. */
create or replace view gastos_por_categoria_dia
with (security_invoker = true)
as
select
  s.propietario,
  s.fecha_operativa,
  m.categoria_id,
  coalesce(c.nombre, 'Sin categoría') as categoria,
  sum(m.monto)::bigint as total,
  count(*)::int as cantidad
from movimientos m
join sesiones_caja s on s.id = m.sesion_id
left join categorias c on c.id = m.categoria_id
where m.estado = 'vigente'
  and m.tipo in ('gasto', 'compra')
group by s.propietario, s.fecha_operativa, m.categoria_id, c.nombre;

/*
 * Ganancia real por día: lo vendido menos lo que costó esa mercancía.
 *
 * Solo cuenta las ventas que pasaron por productos Y tenían costo conocido.
 * Por eso se devuelve también `venta_con_costo`: comparándola con el total
 * vendido del día se sabe qué porcentaje está cubierto. La ganancia nunca
 * debe presentarse sola — «ganaste $180.000» engaña si solo el 20% de las
 * ventas está itemizado.
 */
create or replace view ganancia_por_dia
with (security_invoker = true)
as
select
  s.propietario,
  s.fecha_operativa,
  sum(mi.cantidad * mi.precio_unitario)::bigint as venta_con_costo,
  sum(mi.cantidad * mi.costo_unitario)::bigint   as costo_mercancia,
  sum(mi.cantidad * (mi.precio_unitario - mi.costo_unitario))::bigint as ganancia
from movimientos_inventario mi
join sesiones_caja s on s.id = mi.sesion_id
where mi.estado = 'vigente'
  and mi.tipo = 'venta'
  and mi.costo_unitario > 0
group by s.propietario, s.fecha_operativa;

grant select on resumen_por_dia            to authenticated;
grant select on gastos_por_categoria_dia   to authenticated;
grant select on ganancia_por_dia           to authenticated;
