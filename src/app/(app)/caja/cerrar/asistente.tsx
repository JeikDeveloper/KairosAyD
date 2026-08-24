'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { TecladoPesos } from '@/componentes/teclado-pesos'
import { ETIQUETA_VEREDICTO, type Arqueo } from '@/dominio/arqueo'
import { formatearConSigno, formatearPesos, leerPesos } from '@/dominio/dinero'
import { MOTIVOS_DIFERENCIA, type Billetera, type MotivoDiferencia } from '@/dominio/tipos'
import { cerrarCaja, revelarDiferencias } from '../acciones'

type Paso = 'revisar' | 'contar' | 'revelacion' | 'base' | 'listo'

interface Conteo {
  billeteraId: string
  contado: number
  motivo: MotivoDiferencia | null
  nota: string | null
}

/**
 * Asistente de cierre.
 *
 * El orden de los pasos ES el control: contar primero, revelar después.
 * Mientras el paso es `contar`, este componente no tiene ningún saldo
 * esperado en memoria — no puede filtrarlo aunque quisiera.
 */
export function AsistenteCierre({ billeteras }: { billeteras: Billetera[] }) {
  const router = useRouter()
  const [enviando, iniciarEnvio] = useTransition()

  const [paso, setPaso] = useState<Paso>('revisar')
  const [indice, setIndice] = useState(0)
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [motivos, setMotivos] = useState<Record<string, MotivoDiferencia>>({})
  const [notas, setNotas] = useState<Record<string, string>>({})
  const [arqueo, setArqueo] = useState<Arqueo | null>(null)
  const [base, setBase] = useState('')
  const [error, setError] = useState<string | null>(null)

  const nombreDe = new Map(billeteras.map((b) => [b.id, b.nombre]))
  const efectivo = billeteras.find((b) => b.clase === 'efectivo')

  function conteosActuales(): Conteo[] {
    return billeteras.map((billetera) => ({
      billeteraId: billetera.id,
      contado: leerPesos(textos[billetera.id] ?? '') ?? 0,
      motivo: motivos[billetera.id] ?? null,
      nota: notas[billetera.id]?.trim() || null,
    }))
  }

  // --- Paso 1 · Qué falta registrar ---------------------------------------
  if (paso === 'revisar') {
    return (
      <div className="mt-6 flex flex-col gap-4">
        <p className="text-sm text-tinta-2">
          Antes de contar: la mayoría de los descuadres no son robos, son movimientos que nunca
          se registraron.
        </p>

        <Pregunta
          texto="¿Pagaste algo con la plata del cajón?"
          hrefRegistrar="/registrar"
        />
        <Pregunta
          texto="¿Le compraste mercancía a un proveedor?"
          hrefRegistrar="/registrar"
        />

        <button
          type="button"
          onClick={() => setPaso('contar')}
          className="mt-2 h-14 rounded-lg bg-verde text-base font-bold text-sobre-verde"
        >
          Ya está todo registrado, contar
        </button>
      </div>
    )
  }

  // --- Paso 2 y 3 · Contar, a ciegas --------------------------------------
  if (paso === 'contar') {
    const billetera = billeteras[indice]
    if (!billetera) return null

    const texto = textos[billetera.id] ?? ''
    const valor = leerPesos(texto)
    const esUltima = indice === billeteras.length - 1

    return (
      <div className="mt-6 flex flex-col gap-5">
        <p className="etiqueta">
          Billetera {indice + 1} de {billeteras.length}
        </p>

        <div className="rounded-lg border border-linea bg-superficie p-4">
          <p className="text-sm text-tinta-2">
            {billetera.clase === 'efectivo'
              ? 'Cuenta el efectivo del cajón y escribe cuánto es. No adivines: la app todavía no te va a decir cuánto debería haber.'
              : `Abre ${billetera.nombre} en tu celular y escribe el saldo que ves.`}
          </p>
        </div>

        <TecladoPesos
          key={billetera.id}
          valor={texto}
          alCambiar={(nuevo) => setTextos({ ...textos, [billetera.id]: nuevo })}
          etiqueta={`¿Cuánto hay en ${billetera.nombre}?`}
          autoFoco
        />

        {error ? <Error mensaje={error} /> : null}

        <div className="flex gap-2">
          {indice > 0 ? (
            <button
              type="button"
              onClick={() => setIndice(indice - 1)}
              className="h-14 flex-1 rounded-lg border border-linea bg-superficie text-base font-semibold"
            >
              Atrás
            </button>
          ) : null}

          <button
            type="button"
            disabled={valor === null || enviando}
            onClick={() => {
              setError(null)
              if (!esUltima) {
                setIndice(indice + 1)
                return
              }
              // Solo aquí, con todos los conteos escritos, se pide el esperado.
              iniciarEnvio(async () => {
                const resultado = await revelarDiferencias(conteosActuales())
                if (!resultado) {
                  setError('No se pudo calcular el arqueo. Revisa tu conexión.')
                  return
                }
                setArqueo(resultado)
                setPaso('revelacion')
              })
            }}
            className="h-14 flex-[2] rounded-lg bg-verde text-base font-bold
                       text-sobre-verde disabled:opacity-50"
          >
            {enviando ? 'Calculando…' : esUltima ? 'Ver las diferencias' : 'Siguiente'}
          </button>
        </div>
      </div>
    )
  }

  // --- Paso 4 · La revelación ---------------------------------------------
  if (paso === 'revelacion' && arqueo) {
    const faltanMotivos = arqueo.filas.some(
      (fila) => fila.exigeMotivo && !motivos[fila.billeteraId],
    )

    return (
      <div className="mt-6 flex flex-col gap-4">
        <h2 className="text-lg font-bold">Esto es lo que debería haber</h2>

        {arqueo.filas.map((fila) => (
          <div
            key={fila.billeteraId}
            className={`rounded-lg border p-4 ${colorDeVeredicto(fila.veredicto)}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <b className="text-sm">{nombreDe.get(fila.billeteraId)}</b>
              <span className="font-mono text-[0.625rem] uppercase tracking-wider">
                {ETIQUETA_VEREDICTO[fila.veredicto]}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Dato titulo="Esperado" valor={formatearPesos(fila.esperado)} />
              <Dato titulo="Contaste" valor={formatearPesos(fila.contado)} />
              <Dato titulo="Diferencia" valor={formatearConSigno(fila.diferencia)} resaltado />
            </dl>

            {fila.exigeMotivo ? (
              <div className="mt-3 flex flex-col gap-2">
                <label className="text-xs font-semibold">
                  ¿Qué crees que pasó? <span className="text-ladrillo">Obligatorio</span>
                </label>
                <select
                  value={motivos[fila.billeteraId] ?? ''}
                  onChange={(evento) =>
                    setMotivos({
                      ...motivos,
                      [fila.billeteraId]: evento.target.value as MotivoDiferencia,
                    })
                  }
                  className="h-12 rounded-lg border border-linea bg-superficie px-3 text-sm"
                >
                  <option value="">Escoge un motivo</option>
                  {MOTIVOS_DIFERENCIA.map((motivo) => (
                    <option key={motivo.id} value={motivo.id}>
                      {motivo.texto}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={notas[fila.billeteraId] ?? ''}
                  onChange={(evento) =>
                    setNotas({ ...notas, [fila.billeteraId]: evento.target.value })
                  }
                  placeholder="Nota (opcional)"
                  maxLength={500}
                  className="h-11 rounded-lg border border-linea bg-superficie px-3 text-sm"
                />
              </div>
            ) : null}
          </div>
        ))}

        <p className="text-xs text-tinta-2">
          «No sé qué pasó» es una respuesta válida. Lo que la app no hace es cuadrar sola en
          silencio: si tres días seguidos falta plata sin explicación, eso tiene que poder verse.
        </p>

        {error ? <Error mensaje={error} /> : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setPaso('contar')
              setIndice(0)
              setArqueo(null)
            }}
            className="h-14 flex-1 rounded-lg border border-linea bg-superficie text-base font-semibold"
          >
            Volver a contar
          </button>
          <button
            type="button"
            disabled={faltanMotivos}
            onClick={() => setPaso('base')}
            className="h-14 flex-[2] rounded-lg bg-verde text-base font-bold
                       text-sobre-verde disabled:opacity-50"
          >
            {faltanMotivos ? 'Falta explicar una diferencia' : 'Continuar'}
          </button>
        </div>
      </div>
    )
  }

  // --- Paso 5 · La base de mañana -----------------------------------------
  if (paso === 'base' && arqueo) {
    const efectivoContado = efectivo
      ? (arqueo.filas.find((f) => f.billeteraId === efectivo.id)?.contado ?? 0)
      : 0
    const enPesos = leerPesos(base)
    const valida = enPesos !== null && enPesos >= 0 && enPesos <= efectivoContado
    const retiro = valida ? efectivoContado - (enPesos ?? 0) : null

    return (
      <div className="mt-6 flex flex-col gap-5">
        <h2 className="text-lg font-bold">¿Cuánto dejas para mañana?</h2>

        <div className="rounded-lg border border-linea bg-superficie p-4">
          <p className="text-sm text-tinta-2">
            Contaste <strong>{formatearPesos(efectivoContado)}</strong> en el cajón. Lo que no
            dejes se registra como un retiro tuyo, para que mañana el efectivo esperado sea el
            correcto.
          </p>
        </div>

        <TecladoPesos
          valor={base}
          alCambiar={setBase}
          etiqueta="Efectivo que dejas en el cajón"
          autoFoco
        />

        {retiro !== null ? (
          <p className="text-sm text-tinta-2">
            Se va a registrar un retiro de <strong>{formatearPesos(retiro)}</strong>.
          </p>
        ) : null}

        {enPesos !== null && enPesos > efectivoContado ? (
          <Error mensaje="No puedes dejar más plata de la que contaste en el cajón." />
        ) : null}

        {error ? <Error mensaje={error} /> : null}

        <button
          type="button"
          disabled={!valida || enviando}
          onClick={() => {
            setError(null)
            iniciarEnvio(async () => {
              const resultado = await cerrarCaja({
                conteos: conteosActuales(),
                baseSiguiente: enPesos ?? 0,
                notaCierre: null,
              })
              if (resultado.error) {
                setError(resultado.error)
                return
              }
              setPaso('listo')
              router.refresh()
            })
          }}
          className="h-14 rounded-lg bg-verde text-base font-bold text-sobre-verde
                     disabled:opacity-50"
        >
          {enviando ? 'Cerrando…' : 'Cerrar el día'}
        </button>

        <p className="text-xs text-tinta-3">
          Después de cerrar, los movimientos de hoy no se pueden editar. Las correcciones se
          hacen con un ajuste en la caja de mañana.
        </p>
      </div>
    )
  }

  // --- Listo ---------------------------------------------------------------
  return (
    <div className="mt-8 flex flex-col gap-4 text-center">
      <p className="text-lg font-bold text-verde">Día cerrado</p>
      <p className="text-sm text-tinta-2">
        Quedó todo guardado. Mañana, al abrir la caja, vas a contar contra{' '}
        {formatearPesos(leerPesos(base) ?? 0)}.
      </p>
      <button
        type="button"
        onClick={() => router.push('/hoy')}
        className="h-14 rounded-lg bg-verde text-base font-bold text-sobre-verde"
      >
        Volver al inicio
      </button>
    </div>
  )
}

function Pregunta({ texto, hrefRegistrar }: { texto: string; hrefRegistrar: string }) {
  return (
    <div className="rounded-lg border border-linea bg-superficie p-4">
      <p className="text-base font-semibold">{texto}</p>
      <a
        href={hrefRegistrar}
        className="mt-2 inline-flex min-h-[40px] items-center rounded-lg border border-verde
                   px-4 text-sm font-bold text-verde"
      >
        Sí, registrarlo ahora
      </a>
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

function Error({ mensaje }: { mensaje: string }) {
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

function colorDeVeredicto(veredicto: Arqueo['filas'][number]['veredicto']): string {
  switch (veredicto) {
    case 'cuadra':
      return 'border-verde bg-verde-suave text-verde'
    case 'diferencia_menor':
      return 'border-oro bg-oro-suave text-oro'
    case 'revisar':
      return 'border-ladrillo bg-ladrillo-suave text-ladrillo'
    case 'sin_exigir':
      return 'border-linea bg-superficie text-tinta-2'
  }
}
