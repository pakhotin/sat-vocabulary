import { Navigate, Route, HashRouter, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Loading } from './components/Layout'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Diagnostic } from './pages/Diagnostic'
import { Drill } from './pages/Drill'
import { Editor } from './pages/Editor'
import { Onboarding } from './pages/Onboarding'
import { Progress } from './pages/Progress'
import { Session } from './pages/Session'
import { Settings } from './pages/Settings'
import { Summary } from './pages/Summary'
import { WordPage } from './pages/Word'
import { useStudy } from './study/context'

function Boot({ children }: { children: ReactNode }) {
  const study = useStudy()
  if (!study.ready) return <Loading />
  if (study.error) {
    return (
      <Layout quiet>
        <p role="alert">Saved progress could not be opened. {study.error}</p>
      </Layout>
    )
  }
  return children
}

function Shell({ children, diagnostic = true }: { children: ReactNode; diagnostic?: boolean }) {
  const study = useStudy()
  if (!study.ready) return <Loading />
  if (study.error) {
    return (
      <Layout quiet>
        <p role="alert">Saved progress could not be opened. {study.error}</p>
      </Layout>
    )
  }
  if (!study.profile) return <Navigate to="/start" replace />
  if (diagnostic && !study.profile.diagnosticDone) return <Navigate to="/diagnostic" replace />
  return children
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/start" element={<Boot><Onboarding /></Boot>} />
        <Route
          path="/diagnostic"
          element={
            <Shell diagnostic={false}>
              <Diagnostic />
            </Shell>
          }
        />
        <Route
          path="/"
          element={
            <Shell>
              <Dashboard />
            </Shell>
          }
        />
        <Route
          path="/session"
          element={
            <Shell>
              <Session />
            </Shell>
          }
        />
        <Route
          path="/summary"
          element={
            <Shell>
              <Summary />
            </Shell>
          }
        />
        <Route
          path="/progress"
          element={
            <Shell>
              <Progress />
            </Shell>
          }
        />
        <Route
          path="/drill"
          element={
            <Shell>
              <Drill />
            </Shell>
          }
        />
        <Route
          path="/word/:id"
          element={
            <Shell>
              <WordPage />
            </Shell>
          }
        />
        <Route
          path="/editor"
          element={
            <Shell>
              <Editor />
            </Shell>
          }
        />
        <Route
          path="/settings"
          element={
            <Shell>
              <Settings />
            </Shell>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

