import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <span className="text-lg font-bold tracking-tight">LYNX</span>
          <nav className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get started</Button>
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">LYNX</h1>
        <p className="mt-4 max-w-md text-lg text-muted-foreground">
          Shorten URLs and analyze every click in real time.
        </p>
        <div className="mt-8 flex gap-4">
          <Link href="/register">
            <Button size="lg">Get started</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg">
              Sign in
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
