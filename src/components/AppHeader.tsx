import Link from 'next/link'
import { Plus } from 'lucide-react'

export function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" className="brand">
          ChattyBook
          <span className="brand-tagline">Local models. Real conversations.</span>
        </Link>
        <Link href="/" className="header-action">
          <Plus size={16} aria-hidden="true" />
          New dialogue
        </Link>
      </div>
    </header>
  )
}
