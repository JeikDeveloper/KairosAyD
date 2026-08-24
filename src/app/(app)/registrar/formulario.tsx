'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'

import { TecladoPesos } from '@/componentes/teclado-pesos'
import { leerPesos } from '@/dominio/dinero'
import {
  AYUDA_TIPO,
  ETIQUETA_TIPO,
  TIPOS_MANUALES,
  type Billetera,
  type Categoria,
  type TipoManual,
} from '@/dominio/tipos'
import { registrarMovimiento, type ResultadoRegistro } from './acciones'

const SIN_ERROR: ResultadoRegistro = { error: null }

/**
 * Registro de un movimiento en tres toques para el caso frecuente.
 *
 * La venta en efectivo es el 90% de lo que pasa en el día, así que arranca
 * preseleccionada: tipo «Venta», billetera «Efectivo», cursor en el monto.
 * El dueño escribe la cifra y guarda. Todo lo demás es opcional.
 */
export function FormularioRegistro({
  billeteras,
  categorias,
}: {
  billeteras: Billetera[]
  categorias: Categoria[]
}) {
  const [estado, enviar] = useFormState(registrarMovimiento, SIN_ERROR)

  const [tipo, setTipo] = useState<TipoManual>('venta')
  const [monto, setMonto] = useState('')
  const [billeteraId, setBilleteraId] = useState(
    billeteras.find((b) => b.clase === 'efectivo')?.id ?? billeteras[0]?.id ?? '',
  )
  const [categoriaId, setCategoriaId] = useState('')
  const [nota, setNota] = useState('')

  const esEntrada = tipo === 'venta' || tipo === 'aporte'
  const categoriasVisibles = categorias.filter((c) =>
    esEntrada ? c.aplicaA === 'entrada' : c.aplicaA === 'salida',
  )

  const montoEnPesos = leerPesos(monto)
  const puedeGuardar = montoEnPesos !== null && montoEnPesos > 0 && billeteraId !== ''

  return (
    <form action={enviar} className="flex flex-col gap-5">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="monto" value={montoEnPesos ?? ''} />
      <input type="hidden" name="billeteraId" value={billeteraId} />
      <input type="hidden" name="categoriaId" value={categoriaId} />

      {/* Tipo: botones grandes, no un desplegable. Un desplegable esconde las
          opciones y obliga a dos toques para algo que se hace todo el día. */}
      <fieldset>
        <legend className="sr-only">Tipo de movimiento</legend>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS_MANUALES.map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => {
                setTipo(opcion)
                setCategoriaId('')
              }}
              aria-pressed={tipo === opcion}
              className={`min-h-[52px] rounded-lg border px-3 py-2 text-left text-sm font-bold
                          ${
                            tipo === opcion
                              ? 'border-verde bg-verde-suave text-verde'
                              : 'border-linea bg-superficie text-tinta'
                          }`}
            >
              {ETIQUETA_TIPO[opcion]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-tinta-2">{AYUDA_TIPO[tipo]}</p>
      </fieldset>

      <TecladoPesos valor={monto} alCambiar={setMonto} etiqueta="¿Cuánto?" autoFoco />

      {/* Billetera: siempre visible y siempre explícita. El error más común
          es cobrar por Nequi y registrar en efectivo; un valor por defecto
          escondido lo haría todavía más frecuente. */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">
          {esEntrada ? '¿Por dónde te pagaron?' : '¿De dónde salió?'}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {billeteras.map((billetera) => (
            <button
              key={billetera.id}
              type="button"
              onClick={() => setBilleteraId(billetera.id)}
              aria-pressed={billeteraId === billetera.id}
              className={`min-h-[48px] rounded-lg border px-3 text-sm font-semibold
                          ${
                            billeteraId === billetera.id
                              ? 'border-verde bg-verde-suave text-verde'
                              : 'border-linea bg-superficie text-tinta'
                          }`}
            >
              {billetera.nombre}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Categoría: obligatoria en gastos para que el reporte por categoría
          sirva; opcional en ventas para no frenar la hora pico. */}
      {categoriasVisibles.length > 0 ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            Categoría <span className="font-normal text-tinta-3">(opcional)</span>
          </span>
          <select
            value={categoriaId}
            onChange={(evento) => setCategoriaId(evento.target.value)}
            className="h-12 rounded-lg border border-linea bg-superficie px-3 text-base"
          >
            <option value="">Sin categoría</option>
            {categoriasVisibles.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">
          Nota <span className="font-normal text-tinta-3">(opcional)</span>
        </span>
        <input
          type="text"
          name="nota"
          value={nota}
          onChange={(evento) => setNota(evento.target.value)}
          maxLength={500}
          placeholder="Ej: gaseosas a don Luis"
          className="h-12 rounded-lg border border-linea bg-superficie px-3.5 text-base
                     placeholder:text-tinta-3"
        />
      </label>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-lg border border-ladrillo bg-ladrillo-suave px-3.5 py-2.5
                     text-sm font-semibold text-ladrillo"
        >
          {estado.error}
        </p>
      ) : null}

      <BotonGuardar habilitado={puedeGuardar} tipo={tipo} />
    </form>
  )
}

function BotonGuardar({ habilitado, tipo }: { habilitado: boolean; tipo: TipoManual }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={!habilitado || pending}
      className="sticky bottom-24 h-14 rounded-lg bg-verde text-base font-bold
                 text-sobre-verde disabled:opacity-50"
    >
      {pending ? 'Guardando…' : `Guardar ${ETIQUETA_TIPO[tipo].toLowerCase()}`}
    </button>
  )
}
