import type {
  EstadoMovimiento,
  EstadoSesion,
  TipoMovimiento,
} from '@/dominio/tipos'

/**
 * Tipos de las tablas de Supabase, escritos a mano para que coincidan con
 * `supabase/migrations/0001_esquema_inicial.sql`.
 *
 * Si algún día cambia el esquema, se regeneran con:
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/esquema.ts
 */

type FilaBilletera = {
  id: string
  propietario: string
  nombre: string
  clase: 'efectivo' | 'digital'
  mezclada: boolean
  activa: boolean
  orden: number
  creada_en: string
}

type FilaCategoria = {
  id: string
  propietario: string
  nombre: string
  aplica_a: 'entrada' | 'salida'
  activa: boolean
  creada_en: string
}

type FilaAjustes = {
  propietario: string
  nombre_negocio: string
  umbral_diferencia: number
  horas_para_aviso: number
  actualizado_en: string
}

type FilaSesion = {
  id: string
  propietario: string
  fecha_operativa: string
  estado: EstadoSesion
  abierta_en: string
  cerrada_en: string | null
  conteo_apertura: number
  base_siguiente: number | null
  nota_cierre: string | null
}

type FilaMovimiento = {
  id: string
  propietario: string
  sesion_id: string
  tipo: TipoMovimiento
  monto: number
  billetera_id: string
  categoria_id: string | null
  nota: string | null
  estado: EstadoMovimiento
  grupo_id: string | null
  corrige_a: string | null
  creado_en: string
  anulado_en: string | null
  motivo_anulacion: string | null
}

type FilaConteo = {
  id: string
  propietario: string
  sesion_id: string
  billetera_id: string
  esperado: number
  contado: number
  diferencia: number
  motivo: string | null
  nota: string | null
  creado_en: string
}

type FilaSaldo = {
  propietario: string
  billetera_id: string
  nombre: string
  clase: 'efectivo' | 'digital'
  mezclada: boolean
  orden: number
  saldo: number
}

/** Campos que pone la base de datos y el cliente nunca envía. */
type Insertable<T, Automaticos extends keyof T> = Omit<T, Automaticos> &
  Partial<Pick<T, Automaticos>>

/** Forma que `supabase-js` espera de cada tabla. */
type Tabla<Fila, Automaticos extends keyof Fila> = {
  Row: Fila
  Insert: Insertable<Fila, Automaticos>
  Update: Partial<Fila>
  Relationships: []
}

export type BaseDeDatos = {
  public: {
    Tables: {
      billeteras: Tabla<FilaBilletera, 'id' | 'creada_en' | 'mezclada' | 'activa' | 'orden'>
      categorias: Tabla<FilaCategoria, 'id' | 'creada_en' | 'activa'>
      ajustes_negocio: Tabla<
        FilaAjustes,
        'nombre_negocio' | 'umbral_diferencia' | 'horas_para_aviso' | 'actualizado_en'
      >
      sesiones_caja: Tabla<
        FilaSesion,
        'id' | 'estado' | 'abierta_en' | 'cerrada_en' | 'base_siguiente' | 'nota_cierre'
      >
      movimientos: Tabla<
        FilaMovimiento,
        | 'id'
        | 'estado'
        | 'creado_en'
        | 'anulado_en'
        | 'motivo_anulacion'
        | 'grupo_id'
        | 'corrige_a'
        | 'categoria_id'
        | 'nota'
      >
      conteos_arqueo: Tabla<FilaConteo, 'id' | 'creado_en' | 'motivo' | 'nota'>
    }
    Views: {
      saldos_por_billetera: { Row: FilaSaldo; Relationships: [] }
    }
    Functions: Record<string, never>
    Enums: {
      tipo_movimiento: TipoMovimiento
      estado_movimiento: EstadoMovimiento
      estado_sesion: EstadoSesion
      clase_billetera: 'efectivo' | 'digital'
      direccion_categoria: 'entrada' | 'salida'
    }
    CompositeTypes: Record<string, never>
  }
}
