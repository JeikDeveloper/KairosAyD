/**
 * Lectura de las variables de entorno de Supabase.
 *
 * Falla ruidosamente al arrancar y no en medio de una venta: si faltan las
 * credenciales, es mejor que la app no levante a que el dueño registre
 * movimientos que se pierden en silencio.
 */

function exigir(nombre: string, valor: string | undefined): string {
  if (!valor || valor.trim() === '') {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Copia .env.example a .env.local y pon tus valores de Supabase.`,
    )
  }
  return valor
}

export function credencialesSupabase(): { url: string; clave: string } {
  return {
    url: exigir('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    clave: exigir('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  }
}
