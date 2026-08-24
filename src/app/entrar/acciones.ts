'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { clienteServidor } from '@/lib/supabase/servidor'

const Credenciales = z.object({
  correo: z.string().trim().email('Ese correo no parece válido'),
  clave: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export interface ResultadoEntrar {
  error: string | null
}

/**
 * Mensajes de error en español y sin filtrar información.
 *
 * Nunca se distingue «ese correo no existe» de «esa contraseña está mal»:
 * hacerlo le dice a un desconocido cuáles correos tienen cuenta.
 */
function traducirError(mensaje: string): string {
  const m = mensaje.toLowerCase()
  if (m.includes('invalid login credentials')) return 'El correo o la contraseña no coinciden'
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar'
  if (m.includes('already registered')) return 'Ese correo ya tiene una cuenta'
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Demasiados intentos. Espera un minuto y vuelve a probar'
  if (m.includes('fetch') || m.includes('network'))
    return 'No hay conexión con el servidor. Revisa tu internet'
  return 'No se pudo entrar. Intenta de nuevo'
}

export async function entrar(
  _previo: ResultadoEntrar,
  datos: FormData,
): Promise<ResultadoEntrar> {
  const validado = Credenciales.safeParse({
    correo: datos.get('correo'),
    clave: datos.get('clave'),
  })

  if (!validado.success) {
    return { error: validado.error.issues[0]?.message ?? 'Revisa los datos' }
  }

  const supabase = clienteServidor()
  const { error } = await supabase.auth.signInWithPassword({
    email: validado.data.correo,
    password: validado.data.clave,
  })

  if (error) return { error: traducirError(error.message) }

  const volver = datos.get('volver')
  const destino = typeof volver === 'string' && volver.startsWith('/') ? volver : '/hoy'

  revalidatePath('/', 'layout')
  redirect(destino)
}

export async function crearCuenta(
  _previo: ResultadoEntrar,
  datos: FormData,
): Promise<ResultadoEntrar> {
  const validado = Credenciales.safeParse({
    correo: datos.get('correo'),
    clave: datos.get('clave'),
  })

  if (!validado.success) {
    return { error: validado.error.issues[0]?.message ?? 'Revisa los datos' }
  }

  const supabase = clienteServidor()
  const { error } = await supabase.auth.signUp({
    email: validado.data.correo,
    password: validado.data.clave,
  })

  if (error) return { error: traducirError(error.message) }

  revalidatePath('/', 'layout')
  redirect('/hoy')
}

export async function salir() {
  const supabase = clienteServidor()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/entrar')
}
