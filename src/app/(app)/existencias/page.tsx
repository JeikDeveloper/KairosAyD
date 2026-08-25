import Link from 'next/link'

import { formatearPesos } from '@/dominio/dinero'
import {
  ETIQUETA_ESTADO_STOCK,
  estadoDeStock,
  formatearCantidad,
  porReponer,
  valorDelInventario,
  type EstadoStock,
  type Existencia,
} from '@/dominio/inventario'
import { existencias } from '@/lib/consultas'

export const metadata = { title: 'Existencias · Cuadre Diario' }
export const dynamic = 'force-dynamic'

export default async function PaginaExistencias() {
  const lista = await existencias()
  const controladas = lista.filter((e) => e.controlaStock)
  const reponer = porReponer(lista)
  const valor = valorDelInventario(lista)

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      <h1 className="text-xl font-bold tracking-tight">Existencias</h1>

      {controladas.length === 0 ? (
        <div className="tarjeta p-5 text-center">
          <p className="text-base font-semibold">No hay nada con control de existencias</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-tinta-2">
            Crea productos y activa «llevar cuenta de las existencias» en los que quieras
            controlar.
          </p>
          <Link href="/productos/nuevo" className="boton-principal mt-4">
            Crear un producto
          </Link>
        </div>
      ) : (
        <>
          {/* Plata parada en la estantería. Para un tendero esto es tan
              importante como el saldo de caja: es capital que no está
              disponible y que se puede vencer o perder. */}
          <section>
            <p className="etiqueta mb-1.5">Plata invertida en mercancía</p>
            <p className="cifra text-cifra">{formatearPesos(valor)}</p>
            <p className="mt-1.5 text-[0.6875rem] text-tinta-3">
              Al último costo pagado · {controladas.length} productos con control
            </p>
          </section>

          {reponer.length > 0 ? (
            <section className="tarjeta border-oro p-3">
              <h2 className="etiqueta mb-2 text-oro">Hay que reponer ({reponer.length})</h2>
              <ul>
                {reponer.map((producto) => (
                  <Fila key={producto.productoId} producto={producto} />
                ))}
              </ul>
            </section>
          ) : (
            <p className="tarjeta px-3 py-4 text-center text-sm text-verde">
              Todo con existencias suficientes.
            </p>
          )}

          <section className="tarjeta p-3">
            <h2 className="etiqueta mb-2">Todo lo que controlas</h2>
            <ul>
              {controladas.map((producto) => (
                <Fila key={producto.productoId} producto={producto} />
              ))}
            </ul>
          </section>

          <Link href="/existencias/conteo" className="boton-secundario">
            Hacer un conteo físico
          </Link>

          <p className="text-xs text-tinta-2">
            El conteo se hace a ciegas, igual que el arqueo de caja: cuentas primero y la app te
            muestra después cuánto debería haber. Lo que falte es <b>merma</b>, y es plata
            perdida que conviene ver.
          </p>
        </>
      )}
    </div>
  )
}

function Fila({ producto }: { producto: Existencia }) {
  const estado = estadoDeStock(producto)

  return (
    <li className="flex items-center justify-between gap-3 border-b border-linea py-2 text-sm last:border-b-0">
      <span className="min-w-0 truncate">{producto.nombre}</span>
      <span className="flex shrink-0 items-center gap-2">
        <span className={`pill ${clasePorEstado(estado)}`}>{ETIQUETA_ESTADO_STOCK[estado]}</span>
        <b className="cifra w-20 text-right font-mono text-[0.8125rem] font-semibold">
          {formatearCantidad(producto.cantidad, producto.unidad)}
        </b>
      </span>
    </li>
  )
}

function clasePorEstado(estado: EstadoStock): string {
  switch (estado) {
    case 'negativo':
      return 'bg-ladrillo-suave text-ladrillo'
    case 'agotado':
      return 'bg-ladrillo-suave text-ladrillo'
    case 'bajo':
      return 'bg-oro-suave text-oro'
    case 'normal':
      return 'bg-verde-suave text-verde'
    case 'sin_control':
      return 'bg-superficie-2 text-tinta-3'
  }
}
