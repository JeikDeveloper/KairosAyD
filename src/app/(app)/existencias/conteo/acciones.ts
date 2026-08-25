'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { revelarConteoInventario } from '@/dominio/inventario'
import { existencias as leerExistencias } from '@/lib/consultas'
import { clienteServidor, usuarioActual } from '@/lib/supabase/servidor'

export interface ResultadoConteo {
  error: string | null
}

const Conteo = z.object({
  productoId: z.string().uuid(),
  contado: z.number().min(0).max(1_000_000),
})

const Cierre = z.object({
  conteos: z.array(Conteo).min(1),
  nota: z.string().trim().max(500).nullable(),
})

/**
 * Revela las diferencias del conteo físico.
 *
 * Misma puerta única que en el arqueo de caja: es la ÚNICA forma de obtener
 * la cantidad esperada, y exige recibir el conteo para responder. Si la
 * pantalla pudiera pedirla antes, el dueño escribiría el número esperado sin
 * contar y la merma se volvería invisible.
 */
export async function revelarConteo(conteos: unknown) {
  const validado = z.array(Conteo).safeParse(conteos)
  if (!validado.success) return null

  const lista = await leerExistencias()
  const contados = new Map(validado.data.map((c) => [c.productoId, c.contado]))

  return revelarConteoInventario(lista, contados)
}

/**
 * Guarda el conteo como movimientos de ajuste.
 *
 * La diferencia nunca se resuelve sobrescribiendo el stock: se registra como
 * un movimiento visible que queda para siempre. Así, un producto que falta
 * mes tras mes se puede ver como el patrón que es, en vez de desaparecer en
 * cada conteo.
 */
export async function guardarConteo(payload: unknown): Promise<ResultadoConteo> {
  const usuario = await usuarioActual()
  if (!usuario) redirect('/entrar')

  const validado = Cierre.safeParse(payload)
  if (!validado.success) return { error: 'Faltan datos del conteo' }

  const supabase = clienteServidor()
  const { data: sesion } = await supabase
    .from('sesiones_caja')
    .select('id')
    .eq('estado', 'abierta')
    .maybeSingle()

  if (!sesion) return { error: 'La caja está cerrada. Ábrela antes de guardar el conteo.' }

  // Se recalcula aquí, contra la base, y no se confía en lo que mande el
  // cliente: si el esperado viniera del navegador, cualquiera podría hacer
  // que el conteo cuadre mandando el número que quiera.
  const lista = await leerExistencias()
  const contados = new Map(validado.data.conteos.map((c) => [c.productoId, c.contado]))
  const filas = revelarConteoInventario(lista, contados)

  const ajustes = filas
    .filter((fila) => fila.diferencia !== 0)
    .map((fila) => ({
      propietario: usuario.id,
      producto_id: fila.productoId,
      sesion_id: sesion.id,
      tipo: fila.diferencia > 0 ? ('ajuste_sobrante' as const) : ('ajuste_faltante' as const),
      cantidad: Math.abs(fila.diferencia),
      nota: validado.data.nota ?? 'Diferencia de conteo físico',
    }))

  if (ajustes.length > 0) {
    const { error } = await supabase.from('movimientos_inventario').insert(ajustes)
    if (error) return { error: 'No se pudo guardar el conteo' }
  }

  revalidatePath('/existencias')
  revalidatePath('/productos')
  return { error: null }
}
