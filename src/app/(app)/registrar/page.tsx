import Link from 'next/link'

import { FormularioRegistro } from './formulario'
import { billeteras, categorias, sesionAbierta } from '@/lib/consultas'

export const metadata = { title: 'Registrar · Cuadre Diario' }
export const dynamic = 'force-dynamic'

export default async function PaginaRegistrar() {
  const [sesion, listaBilleteras, listaCategorias] = await Promise.all([
    sesionAbierta(),
    billeteras(),
    categorias(),
  ])

  // Sin caja abierta no se registra nada. Se explica y se ofrece la salida,
  // en vez de mostrar un formulario que va a fallar al guardar.
  if (!sesion) {
    return (
      <div className="px-4 py-6">
        <h1 className="text-xl font-bold">La caja está cerrada</h1>
        <p className="mt-2 text-sm text-tinta-2">
          Para registrar una venta o un gasto primero tienes que abrir la caja del día.
        </p>
        <Link
          href="/caja/abrir"
          className="boton-principal mt-4"
        >
          Abrir caja
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 py-5">
      <h1 className="mb-4 text-xl font-bold tracking-tight">¿Qué vas a registrar?</h1>
      <FormularioRegistro billeteras={listaBilleteras} categorias={listaCategorias} />
    </div>
  )
}
