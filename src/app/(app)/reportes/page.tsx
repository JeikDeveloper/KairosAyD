import { formatearPesos } from '@/dominio/dinero'
import { fechaEnBogota, rangoMes, rangoSemana } from '@/dominio/fecha'
import { resumirPeriodo, totalPorCategoria } from '@/dominio/movimientos'
import { billeteras, categorias } from '@/lib/consultas'
import { clienteServidor } from '@/lib/supabase/servidor'
import type { Movimiento } from '@/dominio/tipos'

export const metadata = { title: 'Reportes · Cuadre Diario' }
export const dynamic = 'force-dynamic'

export default async function PaginaReportes() {
  const hoy = fechaEnBogota()
  const semana = rangoSemana(hoy)
  const mes = rangoMes(hoy)

  const supabase = clienteServidor()
  const { data: sesiones } = await supabase
    .from('sesiones_caja')
    .select('id, fecha_operativa')
    .gte('fecha_operativa', mes.desde)
    .lte('fecha_operativa', mes.hasta)

  const idsDelMes = (sesiones ?? []).map((s) => s.id)
  const idsDeSemana = (sesiones ?? [])
    .filter((s) => s.fecha_operativa >= semana.desde && s.fecha_operativa <= semana.hasta)
    .map((s) => s.id)

  const { data } = idsDelMes.length
    ? await supabase.from('movimientos').select('*').in('sesion_id', idsDelMes)
    : { data: [] }

  const aDominio = (f: NonNullable<typeof data>[number]): Movimiento => ({
    id: f.id,
    sesionId: f.sesion_id,
    tipo: f.tipo,
    monto: f.monto,
    billeteraId: f.billetera_id,
    categoriaId: f.categoria_id,
    nota: f.nota,
    estado: f.estado,
    grupoId: f.grupo_id,
    corrigeA: f.corrige_a,
    creadoEn: f.creado_en,
    anuladoEn: f.anulado_en,
    motivoAnulacion: f.motivo_anulacion,
  })

  const delMes = (data ?? []).map(aDominio)
  const deSemana = delMes.filter((m) => idsDeSemana.includes(m.sesionId))

  const resumenMes = resumirPeriodo(delMes)
  const resumenSemana = resumirPeriodo(deSemana)
  const gastos = totalPorCategoria(delMes, 'salida')

  const listaCategorias = await categorias()
  const nombreCategoria = new Map(listaCategorias.map((c) => [c.id, c.nombre]))
  await billeteras()

  return (
    <div className="px-4 py-5">
      <h1 className="text-xl font-bold tracking-tight">Reportes</h1>

      <Periodo titulo="Esta semana" resumen={resumenSemana} />
      <Periodo titulo="Este mes" resumen={resumenMes} />

      <section className="tarjeta mt-4 p-3">
        <h2 className="etiqueta mb-2">Gastos del mes por categoría</h2>
        {gastos.length > 0 ? (
          <ul className="divide-y divide-linea">
            {gastos.map((fila) => (
              <li key={fila.categoriaId ?? 'sin'} className="flex justify-between py-2 text-sm">
                <span>
                  {fila.categoriaId ? nombreCategoria.get(fila.categoriaId) : 'Sin categoría'}
                  <small className="ml-1.5 text-tinta-3">({fila.cantidad})</small>
                </span>
                <span className="cifra font-mono font-semibold">{formatearPesos(fila.total)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-tinta-2">Todavía no hay gastos este mes.</p>
        )}
      </section>

      <p className="mt-4 text-xs text-tinta-2">
        El <strong>neto</strong> es lo que entró menos lo que salió. No es tu ganancia: todavía
        incluye la plata con la que tienes que reponer lo que vendiste.
      </p>
    </div>
  )
}

function Periodo({
  titulo,
  resumen,
}: {
  titulo: string
  resumen: ReturnType<typeof resumirPeriodo>
}) {
  return (
    <section className="tarjeta mt-4 p-3">
      <h2 className="etiqueta mb-2">{titulo}</h2>
      <dl className="divide-y divide-linea text-sm">
        <div className="flex justify-between py-1.5">
          <dt>Entró</dt>
          <dd className="cifra font-mono font-semibold">{formatearPesos(resumen.entro)}</dd>
        </div>
        <div className="flex justify-between py-1.5">
          <dt>Salió</dt>
          <dd className="cifra font-mono font-semibold">{formatearPesos(resumen.salio)}</dd>
        </div>
        <div className="flex justify-between py-1.5 font-bold">
          <dt>Neto</dt>
          <dd className="cifra font-mono">{formatearPesos(resumen.neto)}</dd>
        </div>
      </dl>
    </section>
  )
}
