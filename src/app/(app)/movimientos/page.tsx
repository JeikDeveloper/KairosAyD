import { ListaMovimientos } from '@/componentes/lista-movimientos'
import { billeteras } from '@/lib/consultas'
import { clienteServidor } from '@/lib/supabase/servidor'
import type { Movimiento } from '@/dominio/tipos'

export const metadata = { title: 'Movimientos · Cuadre Diario' }
export const dynamic = 'force-dynamic'

/**
 * Historial.
 *
 * No es una pestaña: se llega tocando la cifra que no cuadra, y por eso
 * acepta filtros por la URL. Así la lista llega ya acotada a lo que el
 * dueño estaba mirando, sin que tenga que configurar nada.
 */
export default async function PaginaMovimientos({
  searchParams,
}: {
  searchParams: { sesion?: string; billetera?: string }
}) {
  const supabase = clienteServidor()

  let consulta = supabase.from('movimientos').select('*').order('creado_en', { ascending: false }).limit(200)
  if (searchParams.sesion) consulta = consulta.eq('sesion_id', searchParams.sesion)
  if (searchParams.billetera) consulta = consulta.eq('billetera_id', searchParams.billetera)

  const [{ data }, listaBilleteras] = await Promise.all([consulta, billeteras()])

  const movimientos: Movimiento[] = (data ?? []).map((f) => ({
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
  }))

  return (
    <div className="px-4 py-5">
      <h1 className="text-xl font-bold tracking-tight">Movimientos</h1>
      <p className="mt-1 text-sm text-tinta-2">
        {searchParams.sesion ? 'Los de este día.' : 'Los últimos 200.'} Los anulados siguen
        aquí, tachados: nada se borra.
      </p>

      <section className="tarjeta mt-4 p-3">
        {movimientos.length > 0 ? (
          <ListaMovimientos movimientos={movimientos} billeteras={listaBilleteras} />
        ) : (
          <p className="py-6 text-center text-sm text-tinta-2">Todavía no hay movimientos.</p>
        )}
      </section>
    </div>
  )
}
