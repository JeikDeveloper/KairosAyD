'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'

import { TecladoPesos } from '@/componentes/teclado-pesos'
import { formatearPesos, leerPesos } from '@/dominio/dinero'
import { ETIQUETA_UNIDAD, leerCantidad, margenUnitario, type Unidad } from '@/dominio/inventario'
import { crearProducto, type ResultadoProducto } from '../acciones'

const SIN_ERROR: ResultadoProducto = { error: null }
const UNIDADES: Unidad[] = ['unidad', 'libra', 'kilo', 'litro', 'paquete']

export function FormularioProducto() {
  const [estado, enviar] = useFormState(crearProducto, SIN_ERROR)

  const [nombre, setNombre] = useState('')
  const [unidad, setUnidad] = useState<Unidad>('unidad')
  const [precio, setPrecio] = useState('')
  const [costo, setCosto] = useState('')
  const [controlaStock, setControlaStock] = useState(true)
  const [cantidadInicial, setCantidadInicial] = useState('')
  const [stockMinimo, setStockMinimo] = useState('')
  const [favorito, setFavorito] = useState(false)

  const precioEnPesos = leerPesos(precio) ?? 0
  const costoEnPesos = leerPesos(costo) ?? 0
  const margen = margenUnitario({ precioVenta: precioEnPesos, costoActual: costoEnPesos })

  const puedeGuardar = nombre.trim().length > 0 && precioEnPesos > 0

  return (
    <form action={enviar} className="mt-6 flex flex-col gap-6">
      <input type="hidden" name="unidad" value={unidad} />
      <input type="hidden" name="precioVenta" value={precioEnPesos} />
      <input type="hidden" name="costoActual" value={costoEnPesos} />
      <input type="hidden" name="controlaStock" value={controlaStock ? 'si' : 'no'} />
      <input type="hidden" name="favorito" value={favorito ? 'si' : 'no'} />
      <input type="hidden" name="cantidadInicial" value={leerCantidad(cantidadInicial) ?? 0} />
      <input type="hidden" name="stockMinimo" value={leerCantidad(stockMinimo) ?? 0} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">¿Cómo se llama?</span>
        <input
          type="text"
          name="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={60}
          required
          autoFocus
          placeholder="Ej: Gaseosa 400ml"
          className="campo"
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">¿Cómo lo vendes?</legend>
        <div className="grid grid-cols-3 gap-2">
          {UNIDADES.map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => setUnidad(opcion)}
              aria-pressed={unidad === opcion}
              className={`min-h-[46px] rounded-xl border-2 text-sm font-semibold shadow-sm
                          transition-transform duration-100 active:translate-y-px
                          ${
                            unidad === opcion
                              ? 'border-verde bg-verde-suave text-verde'
                              : 'border-linea bg-superficie'
                          }`}
            >
              {ETIQUETA_UNIDAD[opcion].corta}
            </button>
          ))}
        </div>
      </fieldset>

      <TecladoPesos
        valor={precio}
        alCambiar={setPrecio}
        etiqueta={`¿A cuánto lo vendes? (por ${ETIQUETA_UNIDAD[unidad].corta})`}
        nombre="precio"
      />

      <div>
        <TecladoPesos
          valor={costo}
          alCambiar={setCosto}
          etiqueta="¿A cuánto te cuesta?"
          nombre="costo"
        />
        <p className="mt-1 text-xs text-tinta-2">
          {margen ? (
            <>
              Ganas <b className="text-verde">{formatearPesos(margen.pesos)}</b> por{' '}
              {ETIQUETA_UNIDAD[unidad].corta}, un {Math.round(margen.porcentaje)}% sobre el costo.
            </>
          ) : (
            'Puedes dejarlo en blanco: se actualiza solo la primera vez que registres una compra.'
          )}
        </p>
      </div>

      <Interruptor
        activo={controlaStock}
        alCambiar={setControlaStock}
        titulo="Llevar cuenta de las existencias"
        ayuda="Actívalo solo si vas a registrar sus ventas y compras. Un inventario a medias en el que confías es peor que no tenerlo."
      />

      {controlaStock ? (
        <div className="flex flex-col gap-4 border-l-2 border-verde pl-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">
              ¿Cuántas tienes ahora? <span className="font-normal text-tinta-3">(opcional)</span>
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={cantidadInicial}
              onChange={(e) => setCantidadInicial(e.target.value)}
              placeholder="0"
              className="campo"
            />
            <span className="text-xs text-tinta-2">
              Cuéntalas ahora mismo. Este es el punto de partida contra el que se van a comparar
              todos los conteos futuros.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">
              Avisarme cuando queden menos de{' '}
              <span className="font-normal text-tinta-3">(opcional)</span>
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={stockMinimo}
              onChange={(e) => setStockMinimo(e.target.value)}
              placeholder="0"
              className="campo"
            />
          </label>
        </div>
      ) : null}

      <Interruptor
        activo={favorito}
        alCambiar={setFavorito}
        titulo="Mostrarlo de primero al vender"
        ayuda="Para lo que vendes todo el día: queda a un toque en la pantalla de venta."
      />

      {estado.error ? (
        <p
          role="alert"
          className="rounded-lg border border-ladrillo bg-ladrillo-suave px-3.5 py-2.5
                     text-sm font-semibold text-ladrillo"
        >
          {estado.error}
        </p>
      ) : null}

      <BotonGuardar habilitado={puedeGuardar} />
    </form>
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

function BotonGuardar({ habilitado }: { habilitado: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={!habilitado || pending} className="boton-principal min-h-[56px]">
      {pending ? 'Guardando…' : 'Guardar producto'}
    </button>
  )
}
