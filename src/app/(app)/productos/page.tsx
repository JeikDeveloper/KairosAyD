import Link from 'next/link'

import { formatearPesos } from '@/dominio/dinero'
import {
  ETIQUETA_UNIDAD,
  formatearCantidad,
  margenUnitario,
  type Existencia,
} from '@/dominio/inventario'
import { existencias } from '@/lib/consultas'

export const metadata = { title: 'Productos · Cuadre Diario' }
export const dynamic = 'force-dynamic'

export default async function PaginaProductos() {
  const lista = await existencias()

  return (
    <div className="px-4 py-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">Productos</h1>
        <Link href="/productos/nuevo" className="text-sm font-bold text-verde underline underline-offset-4">
          + Nuevo
        </Link>
      </div>

      {lista.length === 0 ? (
        <div className="tarjeta p-5 text-center">
          <p className="text-base font-semibold">Todavía no tienes productos</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-tinta-2">
            No hace falta cargar todo lo que vendes. Empieza por lo caro, lo que más se pierde y
            lo que más rota: cigarrillos, cerveza, gaseosa. Lo demás puedes seguir vendiéndolo
            por monto, sin producto.
          </p>
          <Link href="/productos/nuevo" className="boton-principal mt-4">
            Crear el primero
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((producto) => (
            <FilaProducto key={producto.productoId} producto={producto} />
          ))}
        </ul>
      )}
    </div>
  )
}

function FilaProducto({ producto }: { producto: Existencia }) {
  const margen = margenUnitario(producto)

  return (
    <li>
      <Link
        href={`/productos/${producto.productoId}`}
        className="tarjeta flex items-center justify-between gap-3 p-3 active:bg-superficie-2"
      >
        <span className="min-w-0">
          <b className="block truncate text-[0.9375rem]">
            {producto.favorito ? <span aria-label="Favorito">★ </span> : null}
            {producto.nombre}
          </b>
          <small className="mt-0.5 block text-[0.6875rem] text-tinta-2">
            {formatearPesos(producto.precioVenta)} · por {ETIQUETA_UNIDAD[producto.unidad].larga}
            {margen ? (
              <span className="text-verde"> · gana {formatearPesos(margen.pesos)}</span>
            ) : (
              <span className="text-oro"> · sin costo aún</span>
            )}
          </small>
        </span>

        <span className="shrink-0 text-right">
          {producto.controlaStock ? (
            <b className="cifra block font-mono text-sm font-semibold">
              {formatearCantidad(producto.cantidad, producto.unidad)}
            </b>
          ) : (
            <span className="text-[0.625rem] text-tinta-3">sin control</span>
          )}
        </span>
      </Link>
    </li>
  )
}
