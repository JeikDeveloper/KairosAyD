'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'

import { TecladoPesos } from '@/componentes/teclado-pesos'
import { leerPesos } from '@/dominio/dinero'
import { abrirCaja, type ResultadoCaja } from '../acciones'

const SIN_ERROR: ResultadoCaja = { error: null }

/**
 * Conteo de apertura, a ciegas.
 *
 * En ninguna parte de esta pantalla aparece cuánto quedó ayer. Si apareciera,
 * el dueño escribiría ese número sin contar y la app perdería la única
 * oportunidad de detectar que alguien tocó el cajón fuera del horario.
 */
export function FormularioApertura() {
  const [estado, enviar] = useFormState(abrirCaja, SIN_ERROR)
  const [conteo, setConteo] = useState('')

  const enPesos = leerPesos(conteo)
  const puedeAbrir = enPesos !== null

  return (
    <form action={enviar} className="mt-6 flex flex-col gap-5">
      <input type="hidden" name="conteo" value={enPesos ?? ''} />

      <div className="rounded-lg border border-linea bg-superficie p-4">
        <p className="text-sm text-tinta-2">
          Cuenta el efectivo que hay en el cajón <strong>antes</strong> de empezar a vender, y
          escribe cuánto es. No mires el celular mientras cuentas.
        </p>
      </div>

      <TecladoPesos
        valor={conteo}
        alCambiar={setConteo}
        etiqueta="¿Cuánto efectivo hay en el cajón?"
        autoFoco
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

      <BotonAbrir habilitado={puedeAbrir} />

      <p className="text-xs text-tinta-3">
        Si lo que cuentas no coincide con lo que quedó ayer, la app registra la diferencia y te
        la muestra. No se la queda callada.
      </p>
    </form>
  )
}

function BotonAbrir({ habilitado }: { habilitado: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={!habilitado || pending}
      className="boton-principal min-h-[56px]"
    >
      {pending ? 'Abriendo…' : 'Abrir caja y empezar el día'}
    </button>
  )
}
