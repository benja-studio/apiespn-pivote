import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fútbol API PRO — Plataforma de Telemetría y Estadísticas en Tiempo Real',
  description: 'API REST normalizada y plataforma de datos de fútbol con marcadores en vivo, alineaciones oficiales, estadísticas avanzadas, cara a cara y tablas de posiciones.',
}

export const viewport: Viewport = { colorScheme: 'dark', themeColor: '#090909' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
