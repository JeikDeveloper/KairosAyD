import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import type { BaseDeDatos } from '@/lib/supabase/esquema'

/**
 * Guardián de sesión.
 *
 * Hace dos cosas en cada petición: refresca el token antes de que expire
 * (si no, el dueño se encuentra la sesión caída a media venta) y bloquea
 * las rutas de la app cuando no hay sesión.
 *
 * Sin esto, la app desplegada sería una página pública: cualquiera con el
 * enlace vería los movimientos del negocio.
 */

const RUTAS_PUBLICAS = ['/entrar', '/auth']

export async function middleware(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Sin credenciales no se puede verificar nada. Se deja pasar solo para que
  // la pantalla de configuración explique qué falta, en vez de un 500 seco.
  if (!url || !clave) return respuesta

  const supabase = createServerClient<BaseDeDatos>(url, clave, {
    cookies: {
      getAll() {
        return peticion.cookies.getAll()
      },
      setAll(porGuardar) {
        for (const { name, value } of porGuardar) {
          peticion.cookies.set(name, value)
        }
        respuesta = NextResponse.next({ request: peticion })
        for (const { name, value, options } of porGuardar) {
          respuesta.cookies.set(name, value, options)
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ruta = peticion.nextUrl.pathname
  const esPublica = RUTAS_PUBLICAS.some((publica) => ruta.startsWith(publica))

  if (!user && !esPublica) {
    const destino = peticion.nextUrl.clone()
    destino.pathname = '/entrar'
    // Para devolverlo a donde iba después de entrar.
    destino.searchParams.set('volver', ruta)
    return NextResponse.redirect(destino)
  }

  if (user && ruta === '/entrar') {
    const destino = peticion.nextUrl.clone()
    destino.pathname = '/hoy'
    destino.search = ''
    return NextResponse.redirect(destino)
  }

  return respuesta
}

export const config = {
  matcher: [
    // Todo menos los archivos estáticos y las imágenes.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
