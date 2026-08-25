'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { MONTO_MAXIMO } from '@/dominio/dinero'
import { clienteServidor, usuarioActual } from '@/lib/supabase/servidor'

export interface ResultadoProducto {
  error: string | null
}

const Producto = z.object({
  nombre: z.string().trim().min(1, 'Ponle un nombre').max(60),
  codigo: z.string().trim().max(40).nullish(),
  unidad: z.enum(['unidad', 'libra', 'kilo', 'litro', 'paquete']),
  precioVenta: z.coerce.number().int().min(0).max(MONTO_MAXIMO),
  costoActual: z.coerce.number().int().min(0).max(MONTO_MAXIMO),
  controlaStock: z.coerce.boolean(),
  stockMinimo: z.coerce.number().min(0).max(1_000_000),
  favorito: z.coerce.boolean(),
  cantidadInicial: z.coerce.number().min(0).max(1_000_000),
})

/**
 * Crea un producto y, si se indicó, su inventario inicial.
 *
 * El inventario inicial es un movimiento como cualquier otro, no un campo
 * del producto. Así el stock sigue siendo la suma de movimientos y se puede
 * rastrear de dónde salió cada unidad, incluida la primera.
 */
export async function crearProducto(
  _previo: ResultadoProducto,
  datos: FormData,
): Promise<ResultadoProducto> {
  const usuario = await usuarioActual()
  if (!usuario) redirect('/entrar')

  const validado = Producto.safeParse({
    nombre: datos.get('nombre'),
    codigo: datos.get('codigo') || null,
    unidad: datos.get('unidad'),
    precioVenta: datos.get('precioVenta') || 0,
    costoActual: datos.get('costoActual') || 0,
    controlaStock: datos.get('controlaStock') === 'si',
    stockMinimo: datos.get('stockMinimo') || 0,
    favorito: datos.get('favorito') === 'si',
    cantidadInicial: datos.get('cantidadInicial') || 0,
  })

  if (!validado.success) {
    return { error: validado.error.issues[0]?.message ?? 'Revisa los datos' }
  }

  const d = validado.data
  const supabase = clienteServidor()

  const { data: producto, error } = await supabase
    .from('productos')
    .insert({
      propietario: usuario.id,
      nombre: d.nombre,
      codigo: d.codigo || null,
      unidad: d.unidad,
      precio_venta: d.precioVenta,
      costo_actual: d.costoActual,
      controla_stock: d.controlaStock,
      stock_minimo: d.stockMinimo,
      favorito: d.favorito,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'Ya tienes un producto con ese nombre' }
    return { error: 'No se pudo guardar el producto. Intenta de nuevo.' }
  }

  // El inventario inicial necesita caja abierta, igual que todo lo demás.
  // Si está cerrada, el producto queda creado y se carga el stock después:
  // es mejor eso que perder el producto que el dueño acaba de escribir.
  if (d.cantidadInicial > 0 && producto) {
    const { data: sesion } = await supabase
      .from('sesiones_caja')
      .select('id')
      .eq('estado', 'abierta')
      .maybeSingle()

    if (sesion) {
      await supabase.from('movimientos_inventario').insert({
        propietario: usuario.id,
        producto_id: producto.id,
        sesion_id: sesion.id,
        tipo: 'inventario_inicial',
        cantidad: d.cantidadInicial,
        costo_unitario: d.costoActual,
        nota: 'Carga inicial al crear el producto',
      })
    }
  }

  revalidatePath('/productos')
  revalidatePath('/existencias')
  redirect('/productos')
}

const Edicion = z.object({
  id: z.string().uuid(),
  precioVenta: z.coerce.number().int().min(0).max(MONTO_MAXIMO),
  stockMinimo: z.coerce.number().min(0).max(1_000_000),
  controlaStock: z.coerce.boolean(),
  favorito: z.coerce.boolean(),
})

export async function actualizarProducto(
  _previo: ResultadoProducto,
  datos: FormData,
): Promise<ResultadoProducto> {
  const validado = Edicion.safeParse({
    id: datos.get('id'),
    precioVenta: datos.get('precioVenta') || 0,
    stockMinimo: datos.get('stockMinimo') || 0,
    controlaStock: datos.get('controlaStock') === 'si',
    favorito: datos.get('favorito') === 'si',
  })

  if (!validado.success) return { error: 'Revisa los datos' }

  const supabase = clienteServidor()
  const { error } = await supabase
    .from('productos')
    .update({
      precio_venta: validado.data.precioVenta,
      stock_minimo: validado.data.stockMinimo,
      controla_stock: validado.data.controlaStock,
      favorito: validado.data.favorito,
    })
    .eq('id', validado.data.id)

  // El costo no se edita a mano a propósito: lo actualiza sola la compra.
  // Un costo escrito a dedo convierte el margen en una cifra inventada.

  if (error) return { error: 'No se pudo guardar el cambio' }

  revalidatePath('/productos')
  revalidatePath('/existencias')
  redirect('/productos')
}

/** Se desactiva, no se borra: su historial de movimientos debe sobrevivir. */
export async function archivarProducto(
  _previo: ResultadoProducto,
  datos: FormData,
): Promise<ResultadoProducto> {
  const id = z.string().uuid().safeParse(datos.get('id'))
  if (!id.success) return { error: 'Producto no encontrado' }

  const supabase = clienteServidor()
  const { error } = await supabase.from('productos').update({ activo: false }).eq('id', id.data)

  if (error) return { error: 'No se pudo archivar' }

  revalidatePath('/productos')
  revalidatePath('/existencias')
  return { error: null }
}
