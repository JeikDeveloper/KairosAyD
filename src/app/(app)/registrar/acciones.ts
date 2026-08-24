'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { MONTO_MAXIMO } from '@/dominio/dinero'
import { TIPOS_MANUALES } from '@/dominio/tipos'
import { clienteServidor, usuarioActual } from '@/lib/supabase/servidor'

export interface ResultadoRegistro {
  error: string | null
}

const Movimiento = z.object({
  tipo: z.enum(TIPOS_MANUALES),
  // El monto llega ya normalizado a pesos enteros desde el cliente.
  monto: z.coerce
    .number()
    .int('El monto debe ser en pesos enteros')
    .positive('El monto debe ser mayor que cero')
    .max(MONTO_MAXIMO, 'Ese monto es demasiado grande'),
  billeteraId: z.string().uuid('Escoge una billetera'),
  categoriaId: z.string().uuid().nullish(),
  nota: z.string().trim().max(500).nullish(),
})

/**
 * Registra un movimiento.
 *
 * Lo más importante de esta acción es que sea rápida: si registrar una venta
 * en efectivo cuesta más de tres toques, en hora pico van a quedar ventas sin
 * registrar y al cerrar va a SOBRAR plata en el cajón. Un sobrante es tan
 * grave como un faltante: en ambos casos el dueño deja de confiar en la app.
 */
export async function registrarMovimiento(
  _previo: ResultadoRegistro,
  datos: FormData,
): Promise<ResultadoRegistro> {
  const usuario = await usuarioActual()
  if (!usuario) redirect('/entrar')

  const validado = Movimiento.safeParse({
    tipo: datos.get('tipo'),
    monto: datos.get('monto'),
    billeteraId: datos.get('billeteraId'),
    categoriaId: datos.get('categoriaId') || null,
    nota: datos.get('nota') || null,
  })

  if (!validado.success) {
    return { error: validado.error.issues[0]?.message ?? 'Revisa los datos' }
  }

  const supabase = clienteServidor()

  // Sin caja abierta no hay movimiento. La base también lo impide, pero aquí
  // se puede explicar qué hacer en vez de mostrar un error de Postgres.
  const { data: sesion } = await supabase
    .from('sesiones_caja')
    .select('id')
    .eq('estado', 'abierta')
    .maybeSingle()

  if (!sesion) {
    return { error: 'La caja está cerrada. Ábrela antes de registrar movimientos.' }
  }

  const { error } = await supabase.from('movimientos').insert({
    propietario: usuario.id,
    sesion_id: sesion.id,
    tipo: validado.data.tipo,
    monto: validado.data.monto,
    billetera_id: validado.data.billeteraId,
    categoria_id: validado.data.categoriaId ?? null,
    nota: validado.data.nota ?? null,
  })

  if (error) return { error: 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.' }

  revalidatePath('/hoy')
  revalidatePath('/movimientos')
  redirect('/hoy')
}

/**
 * Anula un movimiento.
 *
 * No lo borra: lo marca como anulado, con motivo y fecha. El registro sigue
 * visible en el historial, tachado. Eso es lo que hace el historial auditable
 * y lo que permite entender, un mes después, por qué un día no cuadró.
 */
export async function anularMovimiento(
  _previo: ResultadoRegistro,
  datos: FormData,
): Promise<ResultadoRegistro> {
  const id = z.string().uuid().safeParse(datos.get('id'))
  const motivo = z.string().trim().min(3, 'Escribe por qué lo anulas').safeParse(datos.get('motivo'))

  if (!id.success) return { error: 'Movimiento no encontrado' }
  if (!motivo.success) return { error: motivo.error.issues[0]?.message ?? 'Falta el motivo' }

  const supabase = clienteServidor()
  const { error } = await supabase
    .from('movimientos')
    .update({
      estado: 'anulado',
      anulado_en: new Date().toISOString(),
      motivo_anulacion: motivo.data,
    })
    .eq('id', id.data)
    .eq('estado', 'vigente')

  if (error) {
    // El día ya cerrado rechaza cambios desde la base de datos.
    return {
      error: 'No se pudo anular. Si el día ya está cerrado, registra un ajuste en la caja de hoy.',
    }
  }

  revalidatePath('/hoy')
  revalidatePath('/movimientos')
  return { error: null }
}

const Traslado = z.object({
  monto: z.coerce.number().int().positive().max(MONTO_MAXIMO),
  desdeId: z.string().uuid(),
  haciaId: z.string().uuid(),
  nota: z.string().trim().max(500).nullish(),
})

/**
 * Traslado entre billeteras: sacar de Nequi y meter al cajón.
 *
 * Se registra como DOS movimientos unidos por un grupo, no como uno solo.
 * Así se mantiene la regla de que cada movimiento afecta una sola billetera,
 * y los reportes pueden excluir los traslados sin casos especiales: mover
 * plata que ya estaba adentro no es una venta.
 */
export async function registrarTraslado(
  _previo: ResultadoRegistro,
  datos: FormData,
): Promise<ResultadoRegistro> {
  const usuario = await usuarioActual()
  if (!usuario) redirect('/entrar')

  const validado = Traslado.safeParse({
    monto: datos.get('monto'),
    desdeId: datos.get('desdeId'),
    haciaId: datos.get('haciaId'),
    nota: datos.get('nota') || null,
  })

  if (!validado.success) return { error: 'Revisa los datos del traslado' }
  if (validado.data.desdeId === validado.data.haciaId) {
    return { error: 'Escoge dos billeteras distintas' }
  }

  const supabase = clienteServidor()
  const { data: sesion } = await supabase
    .from('sesiones_caja')
    .select('id')
    .eq('estado', 'abierta')
    .maybeSingle()

  if (!sesion) return { error: 'La caja está cerrada. Ábrela antes de trasladar.' }

  const grupoId = crypto.randomUUID()
  const comun = {
    propietario: usuario.id,
    sesion_id: sesion.id,
    monto: validado.data.monto,
    grupo_id: grupoId,
    nota: validado.data.nota ?? null,
  }

  const { error } = await supabase.from('movimientos').insert([
    { ...comun, tipo: 'traslado_salida' as const, billetera_id: validado.data.desdeId },
    { ...comun, tipo: 'traslado_entrada' as const, billetera_id: validado.data.haciaId },
  ])

  if (error) return { error: 'No se pudo guardar el traslado. Intenta de nuevo.' }

  revalidatePath('/hoy')
  redirect('/hoy')
}
