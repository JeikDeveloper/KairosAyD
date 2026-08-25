import Link from 'next/link'
import { notFound } from 'next/navigation'

import { DetalleProducto } from './detalle'
import { existencias, sesionAbierta } from '@/lib/consultas'

export const metadata = { title: 'Producto · Cuadre Diario' }
export const dynamic = 'force-dynamic'

export default async function PaginaProducto({ params }: { params: { id: string } }) {
  const [lista, sesion] = await Promise.all([existencias(), sesionAbierta()])
  const producto = lista.find((e) => e.productoId === params.id)

  if (!producto) notFound()

  return (
    <div className="px-4 py-6">
      <Link href="/productos" className="text-sm text-tinta-2 underline underline-offset-4">
        ← Productos
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">{producto.nombre}</h1>
      <DetalleProducto producto={producto} cajaAbierta={Boolean(sesion)} />
    </div>
  )
}
