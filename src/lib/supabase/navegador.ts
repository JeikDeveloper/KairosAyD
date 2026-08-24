'use client'

import { createBrowserClient } from '@supabase/ssr'

import { credencialesSupabase } from './entorno'
import type { BaseDeDatos } from './esquema'

/**
 * Cliente para componentes del navegador.
 * Se memoiza: cada instancia abre su propio canal de refresco de sesión, y
 * varias instancias compitiendo por refrescar el token terminan cerrando
 * la sesión sola.
 */
let cliente: ReturnType<typeof crear> | null = null

function crear() {
  const { url, clave } = credencialesSupabase()
  return createBrowserClient<BaseDeDatos>(url, clave)
}

export function clienteNavegador() {
  if (!cliente) cliente = crear()
  return cliente
}
