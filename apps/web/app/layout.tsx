import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AuthProvider } from '@/lib/auth-context'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'LYNX — short URLs',
  description: 'Acortador de URLs con analytics en tiempo real',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </AuthProvider>
      </body>
    </html>
  )
}
