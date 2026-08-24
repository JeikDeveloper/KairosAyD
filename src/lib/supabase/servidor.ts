import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { credencialesSupabase } from './entorno'
import type { BaseDeDatos } from './esquema'

/**
 * Cliente para Server Components, Route Handlers y Server Actions.
 * Lee y escribe la sesión en cookies.
 */
export function clienteServidor() {
  const almacen = cookies()
  const { url, clave } = credencialesSupabase()

  return createServerClient<BaseDeDatos>(url, clave, {
    cookies: {
      getAll() {
        return almacen.getAll()
      },
      setAll(porGuardar) {
        try {
          for (const { name, value, options } of porGuardar) {
            almacen.set(name, value, options)
          }
        } catch {
          // Los Server Components no pueden escribir cookies. No es un error:
          // el middleware ya refrescó la sesión antes de llegar aquí.
        }
      },
    },
  })
}

/**
 * El usuario de la petición actual, o `null`.
 *
 * Usa `getUser()` y no `getSession()`: `getSession()` devuelve lo que venga
 * en la cookie sin verificarlo contra el servidor, así que una cookie
 * manipulada pasaría como sesión válida.
 */
export async function usuarioActual() {
  const supabase = clienteServidor()
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}
