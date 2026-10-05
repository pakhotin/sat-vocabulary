import { useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import type { SessionStats } from '../questions/expand'
import { useStudy } from '../study/context'

export function Summary() {
  const study = useStudy()
  const location = useLocation()
  const fromState = location.state as SessionStats | null
  const stored = sessionStorage.getItem('sat-vocab-summary')
  const stats = fromState || (stored ? (JSON.parse(stored) as SessionStats) : null)

  return (
    <Layout>
      <div className="stack">
        <h1>Session done</h1>
        {stats ? (
          <>
            <p className="lead">
              You retrieved {stats.correct}, came close on {stats.partial}, and missed {stats.incorrect}.
              {stats.introduced ? ` ${stats.introduced} new ${stats.introduced === 1 ? 'word is' : 'words are'} now on your schedule.` : ''}
            </p>
            <dl className="stats">
              <div>
                <dt>This sitting</dt>
                <dd>{stats.xp} XP</dd>
              </div>
              <div>
                <dt>Streak</dt>
                <dd>{study.meta.streak} {study.meta.streak === 1 ? 'day' : 'days'}</dd>
              </div>
              <div>
                <dt>Total XP</dt>
                <dd>{study.meta.xp}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p>Finish a session to see a summary here.</p>
        )}
        <p>Come back when the next reviews are due. A few careful minutes beat a long cram.</p>
        <Link className="button" to="/">
          Back to today
        </Link>
      </div>
    </Layout>
  )
}
