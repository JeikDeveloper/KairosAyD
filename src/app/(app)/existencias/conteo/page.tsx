import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AsistenteConteo } from './asistente'
import { existencias, sesionAbierta } from '@/lib/consultas'

export const metadata = { title: 'Conteo físico · Cuadre Diario' }
export const dynamic = 'force-dynamic'

export default async function PaginaConteo() {
  const [lista, sesion] = await Promise.all([existencias(), sesionAbierta()])
  const controladas = lista.filter((e) => e.controlaStock)

  if (controladas.length === 0) redirect('/existencias')

  return (
    <div className="px-4 py-6">
      <Link href="/existencias" className="text-sm text-tinta-2 underline underline-offset-4">
        ← Volver sin contar
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">Conteo físico</h1>
      <p className="mt-1 text-sm text-tinta-2">
        {controladas.length} productos con control de existencias
      </p>

      {!sesion ? (
        <div className="tarjeta mt-6 p-4">
          <p className="text-sm text-tinta-2">
            La caja está cerrada. Ábrela antes de contar: el ajuste que salga del conteo tiene que
            quedar registrado en un día abierto.
          </p>
          <Link href="/caja/abrir" className="boton-principal mt-3">
            Abrir caja
          </Link>
        </div>
      ) : (
        // Igual que en el cierre de caja: aquí NO se pasa ninguna cantidad
        // esperada al cliente. Solo llega después del conteo, por
        // `revelarConteo`. Si alguien la pasara "para ahorrar un viaje", el
        // conteo se ajustaría a ese número y la merma dejaría de verse.
        <AsistenteConteo
          productos={controladas.map((e) => ({
            id: e.productoId,
            nombre: e.nombre,
            unidad: e.unidad,
          }))}
        />
      )}
    </div>
  )
}
