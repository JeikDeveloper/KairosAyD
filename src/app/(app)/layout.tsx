import { redirect } from 'next/navigation'

import { BarraInferior } from '@/componentes/barra-inferior'
import { usuarioActual } from '@/lib/supabase/servidor'

/**
 * Envoltura de las pantallas con sesión.
 *
 * El middleware ya bloquea sin sesión; esta segunda verificación existe
 * porque el middleware no corre en todos los caminos (rutas prerenderizadas,
 * peticiones internas) y una sola capa de guarda es una capa de más para
 * confiarse.
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioActual()
  if (!usuario) redirect('/entrar')

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col lg:max-w-5xl">
      <main className="flex-1 pb-24">{children}</main>
      <BarraInferior />
    </div>
  )
}
