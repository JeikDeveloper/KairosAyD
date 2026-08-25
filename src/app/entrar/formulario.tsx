'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'

import { crearCuenta, entrar, type ResultadoEntrar } from './acciones'

const SIN_ERROR: ResultadoEntrar = { error: null }

export function FormularioEntrar({
  volver,
  modoInicial,
}: {
  volver: string
  modoInicial: 'entrar' | 'crear'
}) {
  const [modo, setModo] = useState(modoInicial)
  const accion = modo === 'entrar' ? entrar : crearCuenta
  const [estado, enviar] = useFormState(accion, SIN_ERROR)

  return (
    <form action={enviar} className="flex flex-col gap-4" key={modo}>
      <input type="hidden" name="volver" value={volver} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Correo</span>
        <input
          type="email"
          name="correo"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          className="campo"
          placeholder="tucorreo@ejemplo.com"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Contraseña</span>
        <input
          type="password"
          name="clave"
          required
          minLength={8}
          autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
          className="campo"
          placeholder="Al menos 8 caracteres"
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

      <BotonEnviar modo={modo} />

      <button
        type="button"
        onClick={() => setModo(modo === 'entrar' ? 'crear' : 'entrar')}
        className="mt-1 text-sm text-tinta-2 underline underline-offset-4 hover:text-verde"
      >
        {modo === 'entrar' ? 'Es la primera vez: crear mi cuenta' : 'Ya tengo cuenta, entrar'}
      </button>
    </form>
  )
}

function BotonEnviar({ modo }: { modo: 'entrar' | 'crear' }) {
  // `useFormStatus` solo funciona dentro del <form>, en un componente aparte.
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="boton-principal"
    >
      {pending ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear mi cuenta'}
    </button>
  )
}
