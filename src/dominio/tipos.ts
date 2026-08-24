/**
 * Tipos del dominio. Todo el resto de la app depende de este archivo;
 * este archivo no depende de nada (ni de React, ni de Supabase).
 *
 * Reglas que sostienen el modelo:
 *  1. Solo existe un tipo de registro: el movimiento.
 *  2. Cada movimiento afecta exactamente UNA billetera.
 *  3. El signo lo define el tipo, nunca el monto (los montos son positivos).
 *  4. Los saldos no se guardan: se calculan sumando movimientos.
 *  5. Nada se borra: se anula, y el registro anulado sigue visible.
 */

/** Pesos colombianos, siempre enteros. El peso no tiene centavos en la práctica. */
export type Pesos = number

/** ISO 8601 en UTC, tal como lo devuelve Postgres (`timestamptz`). */
export type Instante = string

/** Fecha operativa `YYYY-MM-DD`. La define la sesión de caja, no el reloj. */
export type FechaOperativa = string

// ---------------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------------

/** Tipos que suman a la billetera. */
export const TIPOS_ENTRADA = [
  'venta',
  'aporte',
  'traslado_entrada',
  'ajuste_sobrante',
] as const

/** Tipos que restan de la billetera. */
export const TIPOS_SALIDA = [
  'gasto',
  'compra',
  'retiro',
  'traslado_salida',
  'ajuste_faltante',
] as const

export type TipoEntrada = (typeof TIPOS_ENTRADA)[number]
export type TipoSalida = (typeof TIPOS_SALIDA)[number]
export type TipoMovimiento = TipoEntrada | TipoSalida

/**
 * Tipos que el dueño elige a mano en el botón «+».
 * Los otros cuatro los crea el sistema: los de traslado al mover plata entre
 * billeteras, y los de ajuste al cerrar caja con diferencia.
 */
export const TIPOS_MANUALES = ['venta', 'gasto', 'compra', 'retiro', 'aporte'] as const
export type TipoManual = (typeof TIPOS_MANUALES)[number]

/** Cómo se le presenta cada tipo al dueño. Sin jerga contable. */
export const ETIQUETA_TIPO: Record<TipoMovimiento, string> = {
  venta: 'Venta',
  gasto: 'Gasto',
  compra: 'Compra a proveedor',
  retiro: 'Retiro',
  aporte: 'Aporte',
  traslado_entrada: 'Traslado (entró)',
  traslado_salida: 'Traslado (salió)',
  ajuste_sobrante: 'Sobrante de arqueo',
  ajuste_faltante: 'Faltante de arqueo',
}

/** Una línea de explicación por tipo, para la hoja de registro. */
export const AYUDA_TIPO: Record<TipoManual, string> = {
  venta: 'Le vendiste algo a un cliente y te pagó',
  gasto: 'Pagaste algo del negocio: servicios, arriendo, transporte',
  compra: 'Le compraste mercancía a un proveedor',
  retiro: 'Sacaste plata del negocio para ti',
  aporte: 'Metiste plata tuya al negocio',
}

export type EstadoMovimiento = 'vigente' | 'anulado'

export interface Movimiento {
  id: string
  /** Sesión de caja a la que pertenece. Sin caja abierta no hay movimiento. */
  sesionId: string
  tipo: TipoMovimiento
  /** Siempre positivo. El signo lo pone `signoDe(tipo)`. */
  monto: Pesos
  billeteraId: string
  categoriaId: string | null
  nota: string | null
  estado: EstadoMovimiento
  /** Agrupa las dos patas de un traslado. */
  grupoId: string | null
  /** Movimiento que este ajuste corrige, si aplica. */
  corrigeA: string | null
  creadoEn: Instante
  /** Cuándo se anuló y por qué. El movimiento original nunca se borra. */
  anuladoEn: Instante | null
  motivoAnulacion: string | null
}

// ---------------------------------------------------------------------------
// Billeteras y categorías
// ---------------------------------------------------------------------------

export interface Billetera {
  id: string
  nombre: string
  /** El efectivo se cuenta a mano; las digitales se leen de la app del banco. */
  clase: 'efectivo' | 'digital'
  /**
   * Cuenta compartida con el uso personal (el Nequi de siempre). A una
   * billetera mezclada no se le exige cuadre exacto: marcarla en rojo todos
   * los días solo enseña a ignorar el rojo.
   */
  mezclada: boolean
  activa: boolean
  orden: number
}

export interface Categoria {
  id: string
  nombre: string
  /** Las categorías de gasto no sirven para clasificar ventas y viceversa. */
  aplicaA: 'entrada' | 'salida'
  activa: boolean
}

// ---------------------------------------------------------------------------
// Caja
// ---------------------------------------------------------------------------

export type EstadoSesion = 'abierta' | 'cerrada'

export interface SesionCaja {
  id: string
  /**
   * El día del negocio, no el del reloj. Una tienda que cierra a las 12:30 a.m.
   * sigue estando en el día anterior hasta que cierre la caja.
   */
  fechaOperativa: FechaOperativa
  estado: EstadoSesion
  abiertaEn: Instante
  cerradaEn: Instante | null
  /** Efectivo contado al abrir, a ciegas. */
  conteoApertura: Pesos
  /** Efectivo que se deja en el cajón para mañana. El resto sale como retiro. */
  baseSiguiente: Pesos | null
  notaCierre: string | null
}

/** Motivos de diferencia. «No sé qué pasó» es una respuesta válida y útil. */
export const MOTIVOS_DIFERENCIA = [
  { id: 'cambio_mal_dado', texto: 'Di mal el cambio' },
  { id: 'sobro_sencillo', texto: 'Sobró sencillo' },
  { id: 'venta_sin_registrar', texto: 'Se me olvidó registrar una venta' },
  { id: 'monto_mal_escrito', texto: 'Escribí mal un monto' },
  { id: 'desconocido', texto: 'No sé qué pasó' },
] as const

export type MotivoDiferencia = (typeof MOTIVOS_DIFERENCIA)[number]['id']

/** Una fila del arqueo: lo que la app esperaba contra lo que el dueño contó. */
export interface ConteoArqueo {
  billeteraId: string
  contado: Pesos
  motivo: MotivoDiferencia | null
  nota: string | null
}
