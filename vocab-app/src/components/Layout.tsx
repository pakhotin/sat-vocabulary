import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

export function Layout({ children, quiet = false }: { children: ReactNode; quiet?: boolean }) {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="app">
        <header className="top">
          <p className="brand">SAT Vocabulary</p>
          {quiet ? null : (
            <nav aria-label="Main">
              <NavLink to="/" end>
                Today
              </NavLink>
              <NavLink to="/progress">Progress</NavLink>
              <NavLink to="/editor">Editor</NavLink>
              <NavLink to="/settings">Settings</NavLink>
            </nav>
          )}
        </header>
        <main id="main">{children}</main>
      </div>
    </>
  )
}

export function Loading({ message = 'Loading your words…' }: { message?: string }) {
  return (
    <Layout quiet>
      <p role="status">{message}</p>
    </Layout>
  )
}
