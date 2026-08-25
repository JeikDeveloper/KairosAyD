'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'

import { TecladoPesos } from '@/componentes/teclado-pesos'
import { formatearPesos, leerPesos } from '@/dominio/dinero'
import {
  ETIQUETA_ESTADO_STOCK,
  ETIQUETA_UNIDAD,
  estadoDeStock,
  formatearCantidad,
  leerCantidad,
  margenUnitario,
  type Existencia,
} from '@/dominio/inventario'
import { registrarMerma, type ResultadoRegistro } from '@/app/(app)/registrar/acciones'
import { actualizarProducto, type ResultadoProducto } from '../acciones'

const SIN_ERROR_P: ResultadoProducto = { error: null }
const SIN_ERROR_M: ResultadoRegistro = { error: null }

export function DetalleProducto({
  producto,
  cajaAbierta,
}: {
  producto: Existencia
  cajaAbierta: boolean
}) {
  const [estadoEdicion, editar] = useFormState(actualizarProducto, SIN_ERROR_P)
  const [estadoMerma, mermar] = useFormState(registrarMerma, SIN_ERROR_M)

  const [precio, setPrecio] = useState(String(producto.precioVenta))
  const [stockMinimo, setStockMinimo] = useState(
    producto.stockMinimo > 0 ? String(producto.stockMinimo) : '',
  )
  const [controlaStock, setControlaStock] = useState(producto.controlaStock)
  const [favorito, setFavorito] = useState(producto.favorito)
  const [cantidadMerma, setCantidadMerma] = useState('')
  const [notaMerma, setNotaMerma] = useState('')

  const precioEnPesos = leerPesos(precio) ?? 0
  const margen = margenUnitario({
    precioVenta: precioEnPesos,
    costoActual: producto.costoActual,
  })
  const estado = estadoDeStock(producto)

  return (
    <div className="mt-5 flex flex-col gap-6">
      {/* Lo que hay ahora */}
      <section className="tarjeta p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="etiqueta">En existencia</span>
          <span className="etiqueta">{ETIQUETA_ESTADO_STOCK[estado]}</span>
        </div>
        <p className="cifra mt-1 text-3xl font-extrabold">
          {producto.controlaStock
            ? formatearCantidad(producto.cantidad, producto.unidad)
            : 'Sin control'}
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-linea pt-3 text-xs">
          <Dato titulo="Precio" valor={formatearPesos(producto.precioVenta)} />
          <Dato
            titulo="Costo"
            valor={producto.costoActual > 0 ? formatearPesos(producto.costoActual) : '—'}
          />
          <Dato
            titulo="Ganas"
            valor={margen ? formatearPesos(margen.pesos) : '—'}
            resaltado
          />
        </dl>
        {producto.costoActual === 0 ? (
          <p className="mt-2 text-xs text-oro">
            Sin costo registrado todavía. Se actualiza solo cuando registres una compra de este
            producto.
          </p>
        ) : null}
      </section>

      {/* Editar */}
      <form action={editar} className="flex flex-col gap-5">
        <h2 className="text-base font-bold">Ajustes del producto</h2>

        <input type="hidden" name="id" value={producto.productoId} />
        <input type="hidden" name="precioVenta" value={precioEnPesos} />
        <input type="hidden" name="stockMinimo" value={leerCantidad(stockMinimo) ?? 0} />
        <input type="hidden" name="controlaStock" value={controlaStock ? 'si' : 'no'} />
        <input type="hidden" name="favorito" value={favorito ? 'si' : 'no'} />

        <TecladoPesos
          valor={precio}
          alCambiar={setPrecio}
          etiqueta={`Precio de venta (por ${ETIQUETA_UNIDAD[producto.unidad].corta})`}
          nombre="precio"
        />

        {/* El costo no se edita a mano: lo actualiza sola la compra. Un costo
            escrito a dedo convierte el margen en una cifra inventada. */}

        <Interruptor
          activo={controlaStock}
          alCambiar={setControlaStock}
          titulo="Llevar cuenta de las existencias"
          ayuda="Si lo apagas, el producto se sigue pudiendo vender pero deja de contarse en el inventario."
        />

        {controlaStock ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Avisarme cuando queden menos de</span>
            <input
              type="text"
              inputMode="decimal"
              value={stockMinimo}
              onChange={(e) => setStockMinimo(e.target.value)}
              placeholder="0"
              className="campo"
            />
          </label>
        ) : null}

        <Interruptor
          activo={favorito}
          alCambiar={setFavorito}
          titulo="Mostrarlo de primero al vender"
          ayuda="Queda a un toque en la pantalla de venta."
        />

        {estadoEdicion.error ? <Aviso mensaje={estadoEdicion.error} /> : null}

        <BotonGuardar />
      </form>

      {/* Merma */}
      <section className="border-t border-linea pt-5">
        <h2 className="text-base font-bold">Registrar merma</h2>
        <p className="mt-1 text-sm text-tinta-2">
          Producto que se venció, se rompió o se perdió. Es al inventario lo que un faltante es a
          la caja: si no queda registrado, aparece como un descuadre inexplicable en el próximo
          conteo.
        </p>

        {!cajaAbierta ? (
          <p className="mt-3 text-sm text-oro">
            Abre la caja para poder registrar una merma.
          </p>
        ) : (
          <form action={mermar} className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="productoId" value={producto.productoId} />
            <input type="hidden" name="cantidad" value={leerCantidad(cantidadMerma) ?? ''} />

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">
                ¿Cuántas se perdieron? ({ETIQUETA_UNIDAD[producto.unidad].larga})
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={cantidadMerma}
                onChange={(e) => setCantidadMerma(e.target.value)}
                placeholder="0"
                className="campo"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">¿Qué pasó?</span>
              <input
                type="text"
                name="nota"
                value={notaMerma}
                onChange={(e) => setNotaMerma(e.target.value)}
                maxLength={500}
                placeholder="Ej: se vencieron"
                className="campo"
              />
            </label>

            {leerCantidad(cantidadMerma) !== null && producto.costoActual > 0 ? (
              <p className="text-sm text-ladrillo">
                Se van a perder{' '}
                <b>
                  {formatearPesos(
                    Math.round((leerCantidad(cantidadMerma) ?? 0) * producto.costoActual),
                  )}
                </b>
                .
              </p>
            ) : null}

            {estadoMerma.error ? <Aviso mensaje={estadoMerma.error} /> : null}

            <BotonMerma
              habilitado={
                leerCantidad(cantidadMerma) !== null && notaMerma.trim().length >= 3
              }
            />
          </form>
        )}
      </section>
    </div>
  )
}

function Dato({
  titulo,
  valor,
  resaltado = false,
}: {
  titulo: string
  valor: string
  resaltado?: boolean
}) {
  return (
    <div>
      <dt className="etiqueta text-[0.5625rem]">{titulo}</dt>
      <dd
        className={`font-mono tabular-nums ${resaltado ? 'font-bold text-verde' : ''}`}
      >
        {valor}
      </dd>
    </div>
  )
}

function Interruptor({
  activo,
  alCambiar,
  titulo,
  ayuda,
}: {
  activo: boolean
  alCambiar: (v: boolean) => void
  titulo: string
  ayuda: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => alCambiar(!activo)}
      className="flex items-start gap-3 text-left"
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-7 w-12 shrink-0 items-center rounded-full p-1
                    transition-colors duration-150 ${activo ? 'bg-verde' : 'bg-linea-fuerte'}`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-superficie shadow transition-transform duration-150
                      ${activo ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </span>
      <span>
        <b className="block text-sm">{titulo}</b>
        <small className="mt-0.5 block text-xs leading-snug text-tinta-2">{ayuda}</small>
      </span>
    </button>
  )
}

function BotonGuardar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="boton-principal">
      {pending ? 'Guardando…' : 'Guardar cambios'}
    </button>
  )
}

function BotonMerma({ habilitado }: { habilitado: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={!habilitado || pending}
      className="boton-secundario border-ladrillo text-ladrillo"
    >
      {pending ? 'Registrando…' : 'Registrar merma'}
    </button>
  )
}

function Aviso({ mensaje }: { mensaje: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-ladrillo bg-ladrillo-suave px-3.5 py-2.5
                 text-sm font-semibold text-ladrillo"
    >
      {mensaje}
    </p>
  )
}
