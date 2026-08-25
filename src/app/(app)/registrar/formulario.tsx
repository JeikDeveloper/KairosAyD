'use client'

import { useState, useTransition } from 'react'
import { useFormState, useFormStatus } from 'react-dom'

import { SelectorProductos } from '@/componentes/selector-productos'
import { TecladoPesos } from '@/componentes/teclado-pesos'
import { formatearPesos, leerPesos } from '@/dominio/dinero'
import { cuadrarVenta, type LineaProducto, type Producto } from '@/dominio/inventario'
import {
  AYUDA_TIPO,
  ETIQUETA_TIPO,
  TIPOS_MANUALES,
  type Billetera,
  type Categoria,
  type TipoManual,
} from '@/dominio/tipos'
import {
  registrarConProductos,
  registrarMovimiento,
  type ResultadoRegistro,
} from './acciones'

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
  productos,
}: {
  billeteras: Billetera[]
  categorias: Categoria[]
  productos: Producto[]
}) {
  const [estado, enviar] = useFormState(registrarMovimiento, SIN_ERROR)
  const [guardando, iniciarGuardado] = useTransition()
  const [errorProductos, setErrorProductos] = useState<string | null>(null)
  const [lineas, setLineas] = useState<LineaProducto[]>([])

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

  // Los productos solo tienen sentido en ventas y compras. Un gasto de
  // arriendo o un retiro no mueven mercancia.
  const admiteProductos = tipo === 'venta' || tipo === 'compra'
  const cuadre = cuadrarVenta(lineas, montoEnPesos ?? 0)

  function guardarConProductos() {
    setErrorProductos(null)
    iniciarGuardado(async () => {
      const resultado = await registrarConProductos({
        tipo: tipo === 'venta' ? 'venta' : 'compra',
        monto: montoEnPesos ?? 0,
        billeteraId,
        categoriaId: categoriaId || null,
        nota: nota.trim() || null,
        lineas,
      })
      if (resultado?.error) setErrorProductos(resultado.error)
    })
  }

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
              className={`min-h-[56px] rounded-xl border-2 px-3 py-2 text-left text-sm font-bold
                          shadow-sm transition-transform duration-100 active:translate-y-px
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
              className={`min-h-[52px] rounded-xl border-2 px-3 text-sm font-semibold
                          shadow-sm transition-transform duration-100 active:translate-y-px
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
            className="campo"
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

      {/* Productos: opcional y plegado. La via rapida --monto, billetera,
          guardar-- queda intacta arriba. Quien no controle inventario ni
          siquiera abre esta seccion. */}
      {admiteProductos && productos.length > 0 ? (
        <details className="tarjeta overflow-hidden">
          <summary className="cursor-pointer list-none px-3 py-3 text-sm font-semibold">
            <span className="mr-1 text-verde">&#9656;</span>
            {lineas.length > 0
              ? `${lineas.length} producto${lineas.length > 1 ? 's' : ''} · ${formatearPesos(cuadre.totalProductos)}`
              : `Detallar productos ${tipo === 'venta' ? 'vendidos' : 'comprados'} (opcional)`}
          </summary>

          <div className="border-t border-linea p-3">
            <SelectorProductos
              productos={productos}
              lineas={lineas}
              alCambiar={setLineas}
              modo={tipo === 'venta' ? 'venta' : 'compra'}
            />

            {lineas.length > 0 && montoEnPesos !== null && !cuadre.coincide ? (
              // No se bloquea: en una tienda se rebaja y se da napa. Pero la
              // diferencia tiene que verse, porque si nadie la mira un
              // producto mal tecleado se cobra mal para siempre.
              <p className="mt-3 rounded-lg border border-oro bg-oro-suave px-3 py-2 text-xs text-oro">
                Los productos suman {formatearPesos(cuadre.totalProductos)} y vas a{' '}
                {tipo === 'venta' ? 'cobrar' : 'pagar'} {formatearPesos(montoEnPesos)}.
                {cuadre.diferencia < 0
                  ? ` Hay ${formatearPesos(Math.abs(cuadre.diferencia))} de rebaja.`
                  : ` Hay ${formatearPesos(cuadre.diferencia)} de mas.`}{' '}
                Puedes continuar si es a proposito.
              </p>
            ) : null}

            {lineas.length > 0 ? (
              <button
                type="button"
                onClick={() => setMonto(String(cuadre.totalProductos))}
                className="mt-2 text-xs font-semibold text-verde underline underline-offset-2"
              >
                Usar {formatearPesos(cuadre.totalProductos)} como monto
              </button>
            ) : null}
          </div>
        </details>
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
          className="campo"
        />
      </label>

      {estado.error || errorProductos ? (
        <p
          role="alert"
          className="rounded-lg border border-ladrillo bg-ladrillo-suave px-3.5 py-2.5
                     text-sm font-semibold text-ladrillo"
        >
          {estado.error ?? errorProductos}
        </p>
      ) : null}

      {lineas.length > 0 ? (
        // Con productos el guardado va por otra accion, que registra la plata
        // y la mercancia enlazadas al mismo movimiento.
        <button
          type="button"
          disabled={!puedeGuardar || guardando}
          onClick={guardarConProductos}
          className="boton-principal sticky bottom-28 min-h-[56px]"
        >
          {guardando
            ? 'Guardando...'
            : `Guardar ${ETIQUETA_TIPO[tipo].toLowerCase()} y descontar`}
        </button>
      ) : (
        <BotonGuardar habilitado={puedeGuardar} tipo={tipo} />
      )}
    </form>
  )
}

function BotonGuardar({ habilitado, tipo }: { habilitado: boolean; tipo: TipoManual }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={!habilitado || pending}
      className="boton-principal sticky bottom-28 min-h-[56px]"
    >
      {pending ? 'Guardando…' : `Guardar ${ETIQUETA_TIPO[tipo].toLowerCase()}`}
    </button>
  )
}
