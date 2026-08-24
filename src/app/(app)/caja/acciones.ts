'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { ajustesDelCierre, retiroPorBaseSiguiente, revelar } from '@/dominio/arqueo'
import { MONTO_MAXIMO } from '@/dominio/dinero'
import { fechaEnBogota } from '@/dominio/fecha'
import {
  MOTIVOS_DIFERENCIA,
  type ConteoArqueo,
  type MotivoDiferencia,
  type TipoMovimiento,
} from '@/dominio/tipos'
import { billeteras as leerBilleteras, ajustesNegocio, saldos } from '@/lib/consultas'
import { clienteServidor, usuarioActual } from '@/lib/supabase/servidor'

export interface ResultadoCaja {
  error: string | null
}

// El `as` conserva los literales del dominio: sin él, `z.enum` los ensancha
// a `string` y cualquier texto pasaría como motivo válido.
const MOTIVOS_VALIDOS = MOTIVOS_DIFERENCIA.map((m) => m.id) as unknown as [
  MotivoDiferencia,
  ...MotivoDiferencia[],
]

/** Fila de `movimientos` tal como la insertamos desde el cierre. */
interface MovimientoPorCrear {
  propietario: string
  sesion_id: string
  tipo: TipoMovimiento
  monto: number
  billetera_id: string
  nota: string
}

// ---------------------------------------------------------------------------
// Abrir
// ---------------------------------------------------------------------------

const Apertura = z.object({
  conteo: z.coerce.number().int().min(0).max(MONTO_MAXIMO),
})

/**
 * Abre la caja del día.
 *
 * El conteo de apertura también va a ciegas: la app no muestra cuánto quedó
 * ayer antes de que el dueño escriba lo que hay en el cajón. Casi siempre
 * coincide y toma dos segundos; cuando no coincide es porque alguien tocó el
 * cajón fuera del horario, que es exactamente lo que hay que detectar.
 */
export async function abrirCaja(
  _previo: ResultadoCaja,
  datos: FormData,
): Promise<ResultadoCaja> {
  const usuario = await usuarioActual()
  if (!usuario) redirect('/entrar')

  const validado = Apertura.safeParse({ conteo: datos.get('conteo') })
  if (!validado.success) return { error: 'Escribe cuánto efectivo hay en el cajón' }

  const supabase = clienteServidor()

  const { data: yaAbierta } = await supabase
    .from('sesiones_caja')
    .select('id')
    .eq('estado', 'abierta')
    .maybeSingle()

  if (yaAbierta) return { error: 'Ya hay una caja abierta. Ciérrala antes de abrir otra.' }

  const { data: sesion, error } = await supabase
    .from('sesiones_caja')
    .insert({
      propietario: usuario.id,
      fecha_operativa: fechaEnBogota(),
      conteo_apertura: validado.data.conteo,
    })
    .select('id')
    .single()

  if (error || !sesion) return { error: 'No se pudo abrir la caja. Intenta de nuevo.' }

  // Si lo contado no coincide con lo que quedó ayer, la diferencia se
  // registra como ajuste ahora mismo: si se dejara pasar, el arqueo de la
  // noche marcaría un faltante que en realidad venía de la mañana.
  const [listaBilleteras, mapaSaldos] = await Promise.all([leerBilleteras(), saldos()])

  const efectivo = listaBilleteras.find((b) => b.clase === 'efectivo')
  if (efectivo) {
    const saldoPrevio = mapaSaldos.get(efectivo.id) ?? 0
    const diferencia = validado.data.conteo - saldoPrevio

    if (diferencia !== 0) {
      await supabase.from('movimientos').insert({
        propietario: usuario.id,
        sesion_id: sesion.id,
        tipo: diferencia > 0 ? 'ajuste_sobrante' : 'ajuste_faltante',
        monto: Math.abs(diferencia),
        billetera_id: efectivo.id,
        nota: 'Diferencia detectada al abrir la caja',
      })
    }
  }

  revalidatePath('/hoy')
  redirect('/hoy')
}

// ---------------------------------------------------------------------------
// Cerrar
// ---------------------------------------------------------------------------

const Conteo = z.object({
  billeteraId: z.string().uuid(),
  contado: z.number().int().min(0).max(MONTO_MAXIMO),
  motivo: z.enum(MOTIVOS_VALIDOS).nullable(),
  nota: z.string().trim().max(500).nullable(),
})

const Cierre = z.object({
  conteos: z.array(Conteo).min(1),
  baseSiguiente: z.number().int().min(0).max(MONTO_MAXIMO),
  notaCierre: z.string().trim().max(500).nullable(),
})

/**
 * Cierra el día.
 *
 * Todo el cierre ocurre en esta función y no en el navegador, por una razón
 * de control: el saldo esperado se recalcula aquí, en el servidor, contra los
 * movimientos reales. Si se confiara en el esperado que el cliente envía,
 * cualquiera podría hacer que el arqueo cuadre mandando el número que quiera.
 */
export async function cerrarCaja(payload: unknown): Promise<ResultadoCaja> {
  const usuario = await usuarioActual()
  if (!usuario) redirect('/entrar')

  const validado = Cierre.safeParse(payload)
  if (!validado.success) return { error: 'Faltan datos del cierre' }

  const supabase = clienteServidor()

  const { data: sesion } = await supabase
    .from('sesiones_caja')
    .select('id')
    .eq('estado', 'abierta')
    .maybeSingle()

  if (!sesion) return { error: 'No hay ninguna caja abierta' }

  const [listaBilleteras, ajustes, mapaSaldos] = await Promise.all([
    leerBilleteras(),
    ajustesNegocio(),
    saldos(),
  ])

  const conteos: ConteoArqueo[] = validado.data.conteos.map((c) => ({
    billeteraId: c.billeteraId,
    contado: c.contado,
    motivo: c.motivo,
    nota: c.nota,
  }))

  const arqueo = revelar(mapaSaldos, listaBilleteras, conteos, ajustes.umbralDiferencia)

  // No se cierra con una diferencia sin explicar. «No sé qué pasó» es un
  // motivo válido; el silencio no. Un cierre que cuadra solo, en silencio,
  // esconde exactamente lo que el arqueo existe para encontrar.
  if (!arqueo.listoParaCerrar) {
    return { error: 'Escoge un motivo para cada diferencia antes de cerrar' }
  }

  const efectivo = listaBilleteras.find((b) => b.clase === 'efectivo')
  const efectivoContado = conteos.find((c) => c.billeteraId === efectivo?.id)?.contado ?? 0

  let retiro: number
  try {
    retiro = retiroPorBaseSiguiente(efectivoContado, validado.data.baseSiguiente)
  } catch {
    return { error: 'No puedes dejar más plata de la que contaste en el cajón' }
  }

  // 1 · Los ajustes de diferencia, para que el saldo quede igual a lo contado.
  const ajustesPorCrear: MovimientoPorCrear[] = ajustesDelCierre(arqueo, conteos).map((a) => ({
    propietario: usuario.id,
    sesion_id: sesion.id,
    tipo: a.tipo,
    monto: a.monto,
    billetera_id: a.billeteraId,
    nota: a.nota,
  }))

  // 2 · El retiro de lo que no se deja como base de mañana. Este es el
  //     momento en que la plata sale del negocio; si no se registra, mañana
  //     el efectivo esperado queda inflado.
  if (retiro > 0 && efectivo) {
    ajustesPorCrear.push({
      propietario: usuario.id,
      sesion_id: sesion.id,
      tipo: 'retiro',
      monto: retiro,
      billetera_id: efectivo.id,
      nota: 'Retiro al cerrar el día',
    })
  }

  if (ajustesPorCrear.length > 0) {
    const { error } = await supabase.from('movimientos').insert(ajustesPorCrear)
    if (error) return { error: 'No se pudieron guardar los ajustes del cierre' }
  }

  // 3 · El arqueo queda congelado: se guarda el esperado tal como estaba al
  //     cerrar, para que el historial no cambie si después se anula algo.
  const { error: errorConteos } = await supabase.from('conteos_arqueo').insert(
    arqueo.filas.map((fila) => {
      const conteo = conteos.find((c) => c.billeteraId === fila.billeteraId)
      return {
        propietario: usuario.id,
        sesion_id: sesion.id,
        billetera_id: fila.billeteraId,
        esperado: fila.esperado,
        contado: fila.contado,
        diferencia: fila.diferencia,
        motivo: conteo?.motivo ?? null,
        nota: conteo?.nota ?? null,
      }
    }),
  )

  if (errorConteos) return { error: 'No se pudo guardar el arqueo' }

  // 4 · Y solo entonces se cierra el día. A partir de aquí queda bloqueado.
  const { error: errorCierre } = await supabase
    .from('sesiones_caja')
    .update({
      estado: 'cerrada',
      cerrada_en: new Date().toISOString(),
      base_siguiente: validado.data.baseSiguiente,
      nota_cierre: validado.data.notaCierre,
    })
    .eq('id', sesion.id)

  if (errorCierre) return { error: 'No se pudo cerrar el día' }

  revalidatePath('/hoy')
  revalidatePath('/caja')
  return { error: null }
}

/**
 * Lo que el dueño contó, para revelarle la diferencia.
 *
 * Se llama SOLO después de que ya escribió todos los conteos. Es la única
 * puerta por la que sale el saldo esperado: si la pantalla pudiera pedirlo
 * antes, el dueño contaría hasta que le diera esa cifra y el arqueo dejaría
 * de medir nada.
 */
export async function revelarDiferencias(conteos: unknown) {
  const validado = z.array(Conteo).safeParse(conteos)
  if (!validado.success) return null

  const [listaBilleteras, ajustes, mapaSaldos] = await Promise.all([
    leerBilleteras(),
    ajustesNegocio(),
    saldos(),
  ])

  return revelar(
    mapaSaldos,
    listaBilleteras,
    validado.data.map((c) => ({
      billeteraId: c.billeteraId,
      contado: c.contado,
      motivo: c.motivo,
      nota: c.nota,
    })),
    ajustes.umbralDiferencia,
  )
}
