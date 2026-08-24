import { redirect } from 'next/navigation'

export default function Raiz() {
  // El middleware ya decidió si hay sesión. Aquí solo se manda al inicio real.
  redirect('/hoy')
}
