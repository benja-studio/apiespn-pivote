import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fútbol API — Datos de fútbol en tiempo real',
  description: 'Marcadores en vivo, alineaciones oficiales, estadísticas avanzadas, cara a cara y tablas de posiciones de fútbol internacional.',
  generator: 'v0.app',
}

export const viewport: Viewport = { colorScheme: 'dark', themeColor: '#07101d' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  )
}
