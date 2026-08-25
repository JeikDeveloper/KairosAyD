import { cache } from 'react'

import { situacionDeCaja, type SituacionCaja } from '@/dominio/arqueo'
import { resumirPeriodo, type ResumenPeriodo } from '@/dominio/movimientos'
import type { Existencia, Producto } from '@/dominio/inventario'
import type {
  Billetera,
  Categoria,
  Movimiento,
  Pesos,
  SesionCaja,
} from '@/dominio/tipos'
import { clienteServidor } from '@/lib/supabase/servidor'

/**
 * Lectura de datos para los Server Components.
 *
 * `cache()` de React evita repetir la misma consulta cuando varios
 * componentes de la misma página piden lo mismo.
 */

// --- Traducción entre las filas de Postgres y los tipos del dominio -------
// El dominio usa nombres en camelCase; la base, snake_case. La conversión
// vive solo aquí para que ni el dominio ni las pantallas la conozcan.

type FilaMovimiento = {
  id: string
  sesion_id: string
  tipo: Movimiento['tipo']
  monto: number
  billetera_id: string
  categoria_id: string | null
  nota: string | null
  estado: Movimiento['estado']
  grupo_id: string | null
  corrige_a: string | null
  creado_en: string
  anulado_en: string | null
  motivo_anulacion: string | null
}

function aMovimiento(fila: FilaMovimiento): Movimiento {
  return {
    id: fila.id,
    sesionId: fila.sesion_id,
    tipo: fila.tipo,
    monto: fila.monto,
    billeteraId: fila.billetera_id,
    categoriaId: fila.categoria_id,
    nota: fila.nota,
    estado: fila.estado,
    grupoId: fila.grupo_id,
    corrigeA: fila.corrige_a,
    creadoEn: fila.creado_en,
    anuladoEn: fila.anulado_en,
    motivoAnulacion: fila.motivo_anulacion,
  }
}

type FilaSesion = {
  id: string
  fecha_operativa: string
  estado: SesionCaja['estado']
  abierta_en: string
  cerrada_en: string | null
  conteo_apertura: number
  base_siguiente: number | null
  nota_cierre: string | null
}

function aSesion(fila: FilaSesion): SesionCaja {
  return {
    id: fila.id,
    fechaOperativa: fila.fecha_operativa,
    estado: fila.estado,
    abiertaEn: fila.abierta_en,
    cerradaEn: fila.cerrada_en,
    conteoApertura: fila.conteo_apertura,
    baseSiguiente: fila.base_siguiente,
    notaCierre: fila.nota_cierre,
  }
}

// --- Consultas -----------------------------------------------------------

export const ajustesNegocio = cache(async () => {
  const supabase = clienteServidor()
  const { data } = await supabase
    .from('ajustes_negocio')
    .select('nombre_negocio, umbral_diferencia, horas_para_aviso')
    .maybeSingle()

  return {
    nombreNegocio: data?.nombre_negocio ?? 'Mi tienda',
    umbralDiferencia: data?.umbral_diferencia ?? 2000,
    horasParaAviso: data?.horas_para_aviso ?? 20,
  }
})

export const billeteras = cache(async (): Promise<Billetera[]> => {
  const supabase = clienteServidor()
  const { data } = await supabase
    .from('billeteras')
    .select('id, nombre, clase, mezclada, activa, orden')
    .eq('activa', true)
    .order('orden')

  return (data ?? []).map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    clase: fila.clase,
    mezclada: fila.mezclada,
    activa: fila.activa,
    orden: fila.orden,
  }))
})

export const categorias = cache(async (): Promise<Categoria[]> => {
  const supabase = clienteServidor()
  const { data } = await supabase
    .from('categorias')
    .select('id, nombre, aplica_a, activa')
    .eq('activa', true)
    .order('nombre')

  return (data ?? []).map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    aplicaA: fila.aplica_a,
    activa: fila.activa,
  }))
})

/**
 * Saldo de cada billetera, calculado por la base con la vista
 * `saldos_por_billetera`. Sumar en Postgres y no en el navegador evita
 * traer años de movimientos al teléfono solo para mostrar un número.
 */
export const saldos = cache(async (): Promise<Map<string, Pesos>> => {
  const supabase = clienteServidor()
  const { data } = await supabase.from('saldos_por_billetera').select('billetera_id, saldo')
  return new Map((data ?? []).map((fila) => [fila.billetera_id, Number(fila.saldo)]))
})

export const sesionAbierta = cache(async (): Promise<SesionCaja | null> => {
  const supabase = clienteServidor()
  const { data } = await supabase
    .from('sesiones_caja')
    .select('id, fecha_operativa, estado, abierta_en, cerrada_en, conteo_apertura, base_siguiente, nota_cierre')
    .eq('estado', 'abierta')
    .maybeSingle()

  return data ? aSesion(data) : null
})

export const ultimaSesionCerrada = cache(async (): Promise<SesionCaja | null> => {
  const supabase = clienteServidor()
  const { data } = await supabase
    .from('sesiones_caja')
    .select('id, fecha_operativa, estado, abierta_en, cerrada_en, conteo_apertura, base_siguiente, nota_cierre')
    .eq('estado', 'cerrada')
    .order('cerrada_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ? aSesion(data) : null
})

export const movimientosDeSesion = cache(async (sesionId: string): Promise<Movimiento[]> => {
  const supabase = clienteServidor()
  const { data } = await supabase
    .from('movimientos')
    .select('*')
    .eq('sesion_id', sesionId)
    .order('creado_en', { ascending: false })

  return (data ?? []).map(aMovimiento)
})

/** Estado completo de la pantalla «Hoy», en una sola función. */
export interface EstadoHoy {
  situacion: SituacionCaja
  billeteras: Billetera[]
  saldos: Map<string, Pesos>
  resumen: ResumenPeriodo
  ultimos: Movimiento[]
  umbralDiferencia: Pesos
}

export async function estadoHoy(): Promise<EstadoHoy> {
  const [abierta, cerrada, listaBilleteras, mapaSaldos, ajustes] = await Promise.all([
    sesionAbierta(),
    ultimaSesionCerrada(),
    billeteras(),
    saldos(),
    ajustesNegocio(),
  ])

  const situacion = situacionDeCaja(abierta, cerrada, ajustes.horasParaAviso)
  const movimientos = abierta ? await movimientosDeSesion(abierta.id) : []

  return {
    situacion,
    billeteras: listaBilleteras,
    saldos: mapaSaldos,
    resumen: resumirPeriodo(movimientos),
    ultimos: movimientos.filter((m) => m.estado === 'vigente').slice(0, 5),
    umbralDiferencia: ajustes.umbralDiferencia,
  }
}

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------

export const productos = cache(async (): Promise<Producto[]> => {
  const supabase = clienteServidor()
  const { data } = await supabase
    .from('productos')
    .select('id, nombre, codigo, unidad, precio_venta, costo_actual, controla_stock, stock_minimo, favorito, activo')
    .eq('activo', true)
    .order('favorito', { ascending: false })
    .order('nombre')

  return (data ?? []).map((f) => ({
    id: f.id,
    nombre: f.nombre,
    codigo: f.codigo,
    unidad: f.unidad,
    precioVenta: f.precio_venta,
    costoActual: f.costo_actual,
    controlaStock: f.controla_stock,
    stockMinimo: Number(f.stock_minimo),
    favorito: f.favorito,
    activo: f.activo,
  }))
})

/**
 * Existencias, calculadas por Postgres con la vista `existencias`.
 *
 * Igual que con los saldos de plata: sumar aquí obligaría a traer todos los
 * movimientos de inventario, y la API corta en 1000 filas. La vista suma la
 * columna entera sin ese límite.
 */
export const existencias = cache(async (): Promise<Existencia[]> => {
  const supabase = clienteServidor()
  const { data } = await supabase
    .from('existencias')
    .select('*')
    .order('favorito', { ascending: false })
    .order('nombre')

  return (data ?? []).map((f) => ({
    productoId: f.producto_id,
    nombre: f.nombre,
    unidad: f.unidad,
    precioVenta: f.precio_venta,
    costoActual: f.costo_actual,
    controlaStock: f.controla_stock,
    stockMinimo: Number(f.stock_minimo),
    favorito: f.favorito,
    cantidad: Number(f.cantidad),
    valorAlCosto: Number(f.valor_al_costo),
  }))
})
