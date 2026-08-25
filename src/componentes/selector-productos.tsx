'use client'

import { useMemo, useState } from 'react'

import { formatearPesos } from '@/dominio/dinero'
import {
  ETIQUETA_UNIDAD,
  formatearCantidad,
  leerCantidad,
  redondearCantidad,
  totalDeLineas,
  type LineaProducto,
  type Producto,
} from '@/dominio/inventario'

/**
 * Selector de productos para una venta o compra.
 *
 * La regla que manda: esto es OPCIONAL y no puede estorbar la vía rápida.
 * Una tienda vende cientos de cosas y solo puede tener cargadas unas pocas;
 * el resto se sigue cobrando por monto. Si itemizar fuera obligatorio, en
 * hora pico se dejarían de registrar ventas y volvería el descuadre.
 *
 * A favor del camino con productos: tocar «Gaseosa» y «Pan» da el total sin
 * que nadie haga la suma mental, que es justo donde se equivocan los montos.
 */
export function SelectorProductos({
  productos,
  lineas,
  alCambiar,
  modo,
}: {
  productos: Producto[]
  lineas: LineaProducto[]
  alCambiar: (lineas: LineaProducto[]) => void
  modo: 'venta' | 'compra'
}) {
  const [busqueda, setBusqueda] = useState('')

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (texto === '') return productos.filter((p) => p.favorito).slice(0, 8)
    return productos
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(texto) ||
          (p.codigo ?? '').toLowerCase().includes(texto),
      )
      .slice(0, 20)
  }, [productos, busqueda])

  function agregar(producto: Producto) {
    const existente = lineas.find((l) => l.productoId === producto.id)
    if (existente) {
      alCambiar(
        lineas.map((l) =>
          l.productoId === producto.id
            ? { ...l, cantidad: redondearCantidad(l.cantidad + 1) }
            : l,
        ),
      )
      return
    }
    alCambiar([
      ...lineas,
      {
        productoId: producto.id,
        cantidad: 1,
        valorUnitario: modo === 'venta' ? producto.precioVenta : producto.costoActual,
      },
    ])
  }

  function cambiarLinea(productoId: string, cambios: Partial<LineaProducto>) {
    alCambiar(
      lineas.map((l) => (l.productoId === productoId ? { ...l, ...cambios } : l)),
    )
  }

  function quitar(productoId: string) {
    alCambiar(lineas.filter((l) => l.productoId !== productoId))
  }

  const total = totalDeLineas(lineas)

  return (
    <div className="flex flex-col gap-3">
      {/* Lo ya agregado va arriba: es lo que el dueño está mirando mientras
          le dicta el cliente, y no puede quedar debajo del teclado. */}
      {lineas.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {lineas.map((linea) => {
            const producto = porId.get(linea.productoId)
            if (!producto) return null

            return (
              <li key={linea.productoId} className="tarjeta p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <b className="truncate text-sm">{producto.nombre}</b>
                  <button
                    type="button"
                    onClick={() => quitar(linea.productoId)}
                    aria-label={`Quitar ${producto.nombre}`}
                    className="shrink-0 px-2 text-lg leading-none text-tinta-3"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Contador
                    valor={linea.cantidad}
                    unidad={ETIQUETA_UNIDAD[producto.unidad].corta}
                    alCambiar={(cantidad) => cambiarLinea(linea.productoId, { cantidad })}
                  />
                  <span className="ml-auto text-right">
                    <small className="block text-[0.625rem] text-tinta-3">
                      {formatearPesos(linea.valorUnitario)} c/u
                    </small>
                    <b className="cifra font-mono text-sm">
                      {formatearPesos(Math.round(linea.cantidad * linea.valorUnitario))}
                    </b>
                  </span>
                </div>
              </li>
            )
          })}

          <li className="flex items-baseline justify-between border-t border-linea-fuerte pt-2 text-sm font-bold">
            <span>Total de productos</span>
            <span className="cifra font-mono">{formatearPesos(total)}</span>
          </li>
        </ul>
      ) : null}

      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar producto…"
        className="campo"
      />

      {visibles.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {visibles.map((producto) => (
            <button
              key={producto.id}
              type="button"
              onClick={() => agregar(producto)}
              className="min-h-[56px] rounded-xl border-2 border-linea bg-superficie px-3 py-2
                         text-left shadow-sm transition-transform duration-100
                         active:translate-y-px active:border-verde active:bg-verde-suave"
            >
              <b className="block truncate text-[0.8125rem]">{producto.nombre}</b>
              <small className="font-mono text-[0.6875rem] text-tinta-2">
                {formatearPesos(
                  modo === 'venta' ? producto.precioVenta : producto.costoActual,
                )}
              </small>
            </button>
          ))}
        </div>
      ) : (
        <p className="py-2 text-center text-xs text-tinta-2">
          {busqueda.trim() === ''
            ? 'Marca productos como favoritos para que aparezcan aquí, o búscalos por nombre.'
            : 'Ningún producto con ese nombre.'}
        </p>
      )}
    </div>
  )
}

/**
 * Contador de cantidad.
 *
 * Los botones de − y + son para el caso normal (unidades enteras) y el campo
 * de texto para lo que se vende a granel: media libra de queso no se llega
 * tocando «+» y en un mostrador nadie tiene tiempo para eso.
 */
function Contador({
  valor,
  unidad,
  alCambiar,
}: {
  valor: number
  unidad: string
  alCambiar: (v: number) => void
}) {
  const [texto, setTexto] = useState<string | null>(null)

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => alCambiar(Math.max(0.001, redondearCantidad(valor - 1)))}
        aria-label="Quitar uno"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-linea-fuerte
                   bg-superficie text-lg font-bold active:bg-superficie-2"
      >
        −
      </button>

      <input
        type="text"
        inputMode="decimal"
        aria-label={`Cantidad en ${unidad}`}
        value={texto ?? formatearCantidad(valor, 'unidad').replace(' und', '')}
        onFocus={(e) => {
          setTexto(e.target.value)
          e.target.select()
        }}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          const leido = leerCantidad(texto ?? '')
          if (leido !== null) alCambiar(leido)
          setTexto(null)
        }}
        className="h-9 w-16 rounded-lg border border-linea-fuerte bg-superficie text-center
                   font-mono text-sm font-semibold tabular-nums focus:border-verde focus:outline-none"
      />

      <button
        type="button"
        onClick={() => alCambiar(redondearCantidad(valor + 1))}
        aria-label="Agregar uno"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-linea-fuerte
                   bg-superficie text-lg font-bold active:bg-superficie-2"
      >
        +
      </button>

      <span className="ml-1 text-[0.6875rem] text-tinta-3">{unidad}</span>
    </span>
  )
}
