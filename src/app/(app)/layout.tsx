import { BarraInferior } from '@/componentes/barra-inferior'

/**
 * Envoltura de las pantallas con sesión.
 *
 * A propósito NO verifica la sesión aquí. Antes llamaba a `getUser()`, que
 * es una consulta de red a Supabase, y el middleware ya hace exactamente esa
 * misma consulta en cada petición: eran dos viajes de ida y vuelta por cada
 * toque, uno de ellos puro desperdicio.
 *
 * Quitarlo no abre ningún hueco:
 *  - El middleware redirige a /entrar antes de que esto se renderice.
 *  - RLS protege los datos aunque alguien saltara el middleware: cada
 *    política se apoya en `auth.uid()`, así que sin sesión válida las
 *    consultas devuelven vacío, no los datos de otro.
 *
 * Además, sin `await` este layout deja de ser un componente asíncrono y
 * puede enviarse al navegador de inmediato, mientras la página de adentro
 * todavía se está armando en el servidor.
 */
export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col lg:max-w-5xl">
      <main className="flex-1 pb-28">{children}</main>
      <BarraInferior />
    </div>
  )
}
