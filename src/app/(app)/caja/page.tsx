import Link from 'next/link'

import { diaCorto, horaEnBogota } from '@/dominio/fecha'
import { formatearPesos } from '@/dominio/dinero'
import { sesionAbierta } from '@/lib/consultas'
import { clienteServidor } from '@/lib/supabase/servidor'

export const metadata = { title: 'Caja · Cuadre Diario' }
export const dynamic = 'force-dynamic'

export default async function PaginaCaja() {
  const supabase = clienteServidor()
  const [abierta, { data: cierres }] = await Promise.all([
    sesionAbierta(),
    supabase
      .from('sesiones_caja')
      .select('id, fecha_operativa, cerrada_en, base_siguiente')
      .eq('estado', 'cerrada')
      .order('fecha_operativa', { ascending: false })
      .limit(30),
  ])

  return (
    <div className="px-4 py-5">
      <h1 className="text-xl font-bold tracking-tight">Caja</h1>

      {abierta ? (
        <Link
          href="/caja/cerrar"
          className="mt-4 flex min-h-[52px] items-center justify-center rounded-lg
                     bg-verde text-base font-bold text-sobre-verde"
        >
          Cerrar el día ({diaCorto(abierta.fechaOperativa)})
        </Link>
      ) : (
        <Link
          href="/caja/abrir"
          className="mt-4 flex min-h-[52px] items-center justify-center rounded-lg
                     bg-verde text-base font-bold text-sobre-verde"
        >
          Abrir caja
        </Link>
      )}

      <h2 className="etiqueta mt-8 mb-2">Cierres anteriores</h2>

      {cierres && cierres.length > 0 ? (
        <ul className="tarjeta divide-y divide-linea">
          {cierres.map((cierre) => (
            <li key={cierre.id} className="flex items-baseline justify-between px-3 py-2.5 text-sm">
              <span>
                {diaCorto(cierre.fecha_operativa)}
                <small className="mt-0.5 block font-mono text-[0.625rem] text-tinta-3">
                  cerrado {cierre.cerrada_en ? horaEnBogota(cierre.cerrada_en) : ''}
                </small>
              </span>
              <span className="cifra font-mono text-xs text-tinta-2">
                base {formatearPesos(cierre.base_siguiente ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tarjeta px-3 py-6 text-center text-sm text-tinta-2">
          Todavía no has cerrado ningún día.
        </p>
      )}
    </div>
  )
}
