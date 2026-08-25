import { formatearPesos } from '@/dominio/dinero'
import {
  fechaEnBogota,
  periodoAnterior,
  rangoMes,
  rangoSemana,
  type RangoFechas,
} from '@/dominio/fecha'
import { variacion } from '@/dominio/movimientos'
import type { Pesos } from '@/dominio/tipos'
import { clienteServidor } from '@/lib/supabase/servidor'

export const metadata = { title: 'Reportes · Cuadre Diario' }
export const dynamic = 'force-dynamic'

/**
 * Reportes.
 *
 * Todo se agrupa en Postgres con las vistas `resumen_por_dia`,
 * `gastos_por_categoria_dia` y `ganancia_por_dia`. Antes esta pantalla traía
 * los movimientos del mes y sumaba aquí, pero la API corta en 1000 filas: una
 * tienda con 50 ventas diarias pasa ese límite en tres semanas y los totales
 * del mes salían cortos, sin ningún error visible.
 */
export default async function PaginaReportes() {
  const hoy = fechaEnBogota()
  const semana = rangoSemana(hoy)
  const mes = rangoMes(hoy)

  const [
    resumenSemana,
    resumenSemanaPasada,
    resumenMes,
    resumenMesPasado,
    gastos,
    ganancia,
  ] = await Promise.all([
    resumenDe(semana),
    resumenDe(periodoAnterior(semana)),
    resumenDe(mes),
    resumenDe(periodoAnterior(mes)),
    gastosDe(mes),
    gananciaDe(mes),
  ])

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      <h1 className="text-xl font-bold tracking-tight">Reportes</h1>

      <Periodo titulo="Esta semana" actual={resumenSemana} anterior={resumenSemanaPasada} />
      <Periodo titulo="Este mes" actual={resumenMes} anterior={resumenMesPasado} />

      {/* La ganancia real solo aparece si hay algo que respalde el número. */}
      {ganancia.ventaConCosto > 0 ? (
        <section className="tarjeta p-3">
          <h2 className="etiqueta mb-2">Ganancia real del mes</h2>
          <p className="cifra text-2xl font-extrabold text-verde">
            {formatearPesos(ganancia.ganancia)}
          </p>
          <dl className="mt-3 divide-y divide-linea text-sm">
            <Linea titulo="Vendido con costo conocido" valor={ganancia.ventaConCosto} />
            <Linea titulo="Lo que costó esa mercancía" valor={ganancia.costoMercancia} />
          </dl>

          {/* La cobertura nunca se omite: «ganaste $180.000» engaña si solo
              el 20% de las ventas está detallado por productos. */}
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-xs ${
              ganancia.cobertura >= 80
                ? 'bg-verde-suave text-verde'
                : 'bg-oro-suave text-oro'
            }`}
          >
            Este número cubre el <b>{Math.round(ganancia.cobertura)}%</b> de lo que vendiste este
            mes.
            {ganancia.cobertura < 80
              ? ' El resto se registró sin detallar productos, así que su ganancia no se puede calcular. Entre más ventas detalles, más confiable es esta cifra.'
              : ' La cifra es confiable.'}
          </p>
        </section>
      ) : (
        <section className="tarjeta p-3">
          <h2 className="etiqueta mb-2">Ganancia real del mes</h2>
          <p className="text-sm text-tinta-2">
            Todavía no se puede calcular. Necesita dos cosas: que los productos tengan costo
            registrado (se actualiza solo al comprar) y que las ventas se detallen por productos.
          </p>
        </section>
      )}

      <section className="tarjeta p-3">
        <h2 className="etiqueta mb-2">Gastos y compras del mes</h2>
        {gastos.length > 0 ? (
          <ul className="divide-y divide-linea">
            {gastos.map((fila) => (
              <li key={fila.categoria} className="flex justify-between py-2 text-sm">
                <span>
                  {fila.categoria}
                  <small className="ml-1.5 text-tinta-3">({fila.cantidad})</small>
                </span>
                <span className="cifra font-mono font-semibold">{formatearPesos(fila.total)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-tinta-2">
            Todavía no hay gastos este mes.
          </p>
        )}
      </section>

      <p className="text-xs text-tinta-2">
        El <b>neto</b> es lo que entró menos lo que salió. No es tu ganancia: todavía incluye la
        plata con la que tienes que reponer lo que vendiste. La ganancia real está arriba, y solo
        cuenta lo que se vendió con productos detallados.
      </p>
    </div>
  )
}

// --- Consultas agregadas ---------------------------------------------------

interface Resumen {
  entro: Pesos
  salio: Pesos
  neto: Pesos
}

async function resumenDe(rango: RangoFechas): Promise<Resumen> {
  const supabase = clienteServidor()
  const { data } = await supabase
    .from('resumen_por_dia')
    .select('entro, salio, neto')
    .gte('fecha_operativa', rango.desde)
    .lte('fecha_operativa', rango.hasta)

  return (data ?? []).reduce<Resumen>(
    (suma, fila) => ({
      entro: suma.entro + Number(fila.entro),
      salio: suma.salio + Number(fila.salio),
      neto: suma.neto + Number(fila.neto),
    }),
    { entro: 0, salio: 0, neto: 0 },
  )
}

async function gastosDe(rango: RangoFechas) {
  const supabase = clienteServidor()
  const { data } = await supabase
    .from('gastos_por_categoria_dia')
    .select('categoria, total, cantidad')
    .gte('fecha_operativa', rango.desde)
    .lte('fecha_operativa', rango.hasta)

  const acumulado = new Map<string, { total: number; cantidad: number }>()
  for (const fila of data ?? []) {
    const previo = acumulado.get(fila.categoria) ?? { total: 0, cantidad: 0 }
    acumulado.set(fila.categoria, {
      total: previo.total + Number(fila.total),
      cantidad: previo.cantidad + Number(fila.cantidad),
    })
  }

  return [...acumulado.entries()]
    .map(([categoria, datos]) => ({ categoria, ...datos }))
    .sort((a, b) => b.total - a.total)
}

async function gananciaDe(rango: RangoFechas) {
  const supabase = clienteServidor()
  const [{ data: filas }, resumen] = await Promise.all([
    supabase
      .from('ganancia_por_dia')
      .select('venta_con_costo, costo_mercancia, ganancia')
      .gte('fecha_operativa', rango.desde)
      .lte('fecha_operativa', rango.hasta),
    resumenDe(rango),
  ])

  const totales = (filas ?? []).reduce(
    (suma, fila) => ({
      ventaConCosto: suma.ventaConCosto + Number(fila.venta_con_costo),
      costoMercancia: suma.costoMercancia + Number(fila.costo_mercancia),
      ganancia: suma.ganancia + Number(fila.ganancia),
    }),
    { ventaConCosto: 0, costoMercancia: 0, ganancia: 0 },
  )

  return {
    ...totales,
    cobertura: resumen.entro > 0 ? (totales.ventaConCosto / resumen.entro) * 100 : 0,
  }
}

// --- Presentación ----------------------------------------------------------

function Periodo({
  titulo,
  actual,
  anterior,
}: {
  titulo: string
  actual: Resumen
  anterior: Resumen
}) {
  const cambio = variacion(actual.entro, anterior.entro)

  return (
    <section className="tarjeta p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="etiqueta">{titulo}</h2>
        {/* Sin comparativo cuando el periodo anterior fue cero: «subió un
            100%» contra un periodo sin ventas no significa nada. */}
        {cambio !== null ? (
          <span
            className={`font-mono text-[0.6875rem] font-semibold ${
              cambio >= 0 ? 'text-verde' : 'text-ladrillo'
            }`}
          >
            {cambio >= 0 ? '▲' : '▼'} {Math.abs(Math.round(cambio))}% vs. el anterior
          </span>
        ) : null}
      </div>
      <dl className="divide-y divide-linea text-sm">
        <Linea titulo="Entró" valor={actual.entro} />
        <Linea titulo="Salió" valor={actual.salio} />
        <Linea titulo="Neto" valor={actual.neto} destacado />
      </dl>
    </section>
  )
}

function Linea({
  titulo,
  valor,
  destacado = false,
}: {
  titulo: string
  valor: Pesos
  destacado?: boolean
}) {
  return (
    <div className={`flex justify-between py-1.5 ${destacado ? 'font-bold' : ''}`}>
      <dt>{titulo}</dt>
      <dd className="cifra font-mono font-semibold">{formatearPesos(valor)}</dd>
    </div>
  )
}
