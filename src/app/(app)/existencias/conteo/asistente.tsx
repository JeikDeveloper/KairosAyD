'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { formatearConSigno } from '@/dominio/dinero'
import {
  ETIQUETA_UNIDAD,
  formatearCantidad,
  leerCantidad,
  valorDeLaMerma,
  type FilaConteoInventario,
  type Unidad,
} from '@/dominio/inventario'
import { guardarConteo, revelarConteo } from './acciones'

interface ProductoParaContar {
  id: string
  nombre: string
  unidad: Unidad
}

type Paso = 'contar' | 'revelacion' | 'listo'

/**
 * Conteo físico de mercancía.
 *
 * Mismo control que el arqueo de caja y por la misma razón: se cuenta
 * primero y la app revela el esperado después. Mientras el paso es `contar`,
 * este componente no tiene ninguna cantidad esperada en memoria.
 */
export function AsistenteConteo({ productos }: { productos: ProductoParaContar[] }) {
  const router = useRouter()
  const [enviando, iniciarEnvio] = useTransition()

  const [paso, setPaso] = useState<Paso>('contar')
  const [indice, setIndice] = useState(0)
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [filas, setFilas] = useState<FilaConteoInventario[]>([])
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)

  function conteosActuales() {
    return productos
      .filter((p) => textos[p.id] !== undefined && textos[p.id] !== '')
      .map((p) => ({ productoId: p.id, contado: leerCantidad(textos[p.id] ?? '') ?? 0 }))
  }

  // --- Contar, a ciegas ----------------------------------------------------
  if (paso === 'contar') {
    const producto = productos[indice]
    if (!producto) return null

    const texto = textos[producto.id] ?? ''
    const esUltimo = indice === productos.length - 1
    const contados = conteosActuales().length

    return (
      <div className="mt-6 flex flex-col gap-5">
        <div>
          <p className="etiqueta mb-1">
            Producto {indice + 1} de {productos.length}
          </p>
          <div className="h-1 w-full overflow-hidden rounded-full bg-superficie-2">
            <div
              className="h-full rounded-full bg-verde transition-all duration-200"
              style={{ width: `${((indice + 1) / productos.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="tarjeta p-4">
          <p className="text-sm text-tinta-2">
            Cuenta cuántas <b>{producto.nombre}</b> hay en la estantería y escríbelo. No adivines:
            la app todavía no te va a decir cuántas debería haber.
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            ¿Cuántas hay? ({ETIQUETA_UNIDAD[producto.unidad].larga})
          </span>
          <input
            key={producto.id}
            type="text"
            inputMode="decimal"
            autoFocus
            value={texto}
            onChange={(e) => setTextos({ ...textos, [producto.id]: e.target.value })}
            placeholder="0"
            className="h-16 w-full rounded-xl border-2 border-linea-fuerte bg-superficie px-4
                       text-right font-mono text-2xl font-bold tabular-nums shadow-sm
                       placeholder:text-tinta-3 focus:border-verde focus:outline-none"
          />
          <span className="text-xs text-tinta-3">
            Déjalo en blanco para saltar este producto y no incluirlo en el conteo.
          </span>
        </label>

        {error ? <Aviso mensaje={error} /> : null}

        <div className="flex gap-2">
          {indice > 0 ? (
            <button
              type="button"
              onClick={() => setIndice(indice - 1)}
              className="boton-secundario flex-1"
            >
              Atrás
            </button>
          ) : null}

          <button
            type="button"
            disabled={enviando}
            onClick={() => {
              setError(null)
              if (!esUltimo) {
                setIndice(indice + 1)
                return
              }
              if (contados === 0) {
                setError('No contaste ningún producto todavía.')
                return
              }
              iniciarEnvio(async () => {
                const resultado = await revelarConteo(conteosActuales())
                if (!resultado) {
                  setError('No se pudo calcular el conteo. Revisa tu conexión.')
                  return
                }
                setFilas(resultado)
                setPaso('revelacion')
              })
            }}
            className="boton-principal flex-[2]"
          >
            {enviando ? 'Calculando…' : esUltimo ? `Ver diferencias (${contados})` : 'Siguiente'}
          </button>
        </div>
      </div>
    )
  }

  // --- La revelación -------------------------------------------------------
  if (paso === 'revelacion') {
    const conDiferencia = filas.filter((f) => f.diferencia !== 0)
    const merma = valorDeLaMerma(filas)

    return (
      <div className="mt-6 flex flex-col gap-4">
        <h2 className="text-lg font-bold">Esto es lo que debería haber</h2>

        {conDiferencia.length === 0 ? (
          <p className="tarjeta border-verde bg-verde-suave px-3 py-6 text-center text-sm font-semibold text-verde">
            Todo cuadró. No falta ni sobra nada.
          </p>
        ) : (
          <>
            <div
              className={`tarjeta p-4 ${merma < 0 ? 'border-ladrillo bg-ladrillo-suave' : 'border-verde bg-verde-suave'}`}
            >
              <p className="etiqueta mb-1">
                {merma < 0 ? 'Mercancía perdida' : 'Mercancía de más'}
              </p>
              <p
                className={`cifra text-2xl font-extrabold ${merma < 0 ? 'text-ladrillo' : 'text-verde'}`}
              >
                {formatearConSigno(merma)}
              </p>
              <p className="mt-1 text-xs text-tinta-2">
                {merma < 0
                  ? 'Esto es plata que ya se gastó y que no se va a recuperar vendiendo. Suele ser vencimiento, rotura o robo.'
                  : 'Sobró mercancía: casi siempre significa que falta registrar una venta o que una compra se contó de más.'}
              </p>
            </div>

            <ul className="flex flex-col gap-2">
              {conDiferencia.map((fila) => (
                <li key={fila.productoId} className="tarjeta p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <b className="truncate text-sm">{fila.nombre}</b>
                    <b
                      className={`cifra shrink-0 font-mono text-sm ${
                        fila.diferencia < 0 ? 'text-ladrillo' : 'text-verde'
                      }`}
                    >
                      {fila.diferencia > 0 ? '+' : '−'}
                      {formatearCantidad(Math.abs(fila.diferencia), fila.unidad)}
                    </b>
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <Dato titulo="Debería" valor={formatearCantidad(fila.esperado, fila.unidad)} />
                    <Dato titulo="Contaste" valor={formatearCantidad(fila.contado, fila.unidad)} />
                    <Dato titulo="Vale" valor={formatearConSigno(fila.valorDiferencia)} resaltado />
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            ¿Qué crees que pasó? <span className="font-normal text-tinta-3">(opcional)</span>
          </span>
          <input
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={500}
            placeholder="Ej: se vencieron dos gaseosas"
            className="campo"
          />
        </label>

        {error ? <Aviso mensaje={error} /> : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setPaso('contar')
              setIndice(0)
              setFilas([])
            }}
            className="boton-secundario flex-1"
          >
            Volver a contar
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={() => {
              setError(null)
              iniciarEnvio(async () => {
                const resultado = await guardarConteo({
                  conteos: conteosActuales(),
                  nota: nota.trim() || null,
                })
                if (resultado.error) {
                  setError(resultado.error)
                  return
                }
                setPaso('listo')
                router.refresh()
              })
            }}
            className="boton-principal flex-[2]"
          >
            {enviando ? 'Guardando…' : 'Guardar el conteo'}
          </button>
        </div>

        <p className="text-xs text-tinta-3">
          Cada diferencia queda como un movimiento visible en el historial del producto. Un
          faltante que se repite mes tras mes es un patrón que conviene poder ver.
        </p>
      </div>
    )
  }

  // --- Listo ---------------------------------------------------------------
  return (
    <div className="mt-8 flex flex-col gap-4 text-center">
      <p className="text-lg font-bold text-verde">Conteo guardado</p>
      <p className="text-sm text-tinta-2">
        Las existencias quedaron iguales a lo que contaste, y las diferencias quedaron
        registradas.
      </p>
      <button
        type="button"
        onClick={() => router.push('/existencias')}
        className="boton-principal"
      >
        Ver existencias
      </button>
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
      <dd className={`font-mono tabular-nums ${resaltado ? 'font-bold' : ''}`}>{valor}</dd>
    </div>
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
