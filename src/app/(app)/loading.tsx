import { EsqueletoPagina } from '@/componentes/esqueleto'

/**
 * Estado de carga compartido por todas las pantallas con sesión.
 *
 * Hace dos cosas, y la segunda importa más que la primera:
 *
 *  1. Da respuesta inmediata al toque, en vez de dejar la pantalla vieja
 *     congelada mientras el servidor responde.
 *  2. Le da a <Link> una frontera que precargar. Sin `loading`, Next no
 *     puede precargar nada de una ruta dinámica y cada navegación arranca
 *     de cero al momento del clic.
 */
export default function Cargando() {
  return <EsqueletoPagina />
}
