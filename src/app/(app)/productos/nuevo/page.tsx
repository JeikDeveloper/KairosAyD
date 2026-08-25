import Link from 'next/link'

import { FormularioProducto } from './formulario'

export const metadata = { title: 'Nuevo producto · Cuadre Diario' }

export default function PaginaNuevoProducto() {
  return (
    <div className="px-4 py-6">
      <Link href="/productos" className="text-sm text-tinta-2 underline underline-offset-4">
        ← Volver
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Nuevo producto</h1>
      <FormularioProducto />
    </div>
  )
}
