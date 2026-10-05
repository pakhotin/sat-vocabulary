import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { dailyNewCap, newCapIsHigh, progressCounts } from '../srs/progress'
import { makePlan } from '../study/plan'
import { toMastery } from '../study/reviews'
import { useStudy } from '../study/context'

const SESSION_KEY = 'sat-vocab-session'

export function Dashboard() {
  const study = useStudy()
  const navigate = useNavigate()
  const profile = study.profile
  const [resume] = useState(() => Boolean(sessionStorage.getItem(SESSION_KEY)))
  if (!profile) return null
  const snapshot = makePlan({ words: study.words, reviews: study.reviews, profile, meta: study.meta })
  const counts = progressCounts(study.reviews.map(toMastery))
  const cap = dailyNewCap(profile.dailyMinutes, profile.pace)
  const newWaiting = snapshot.due > snapshot.sessionReviews || (snapshot.sessionNew === 0 && snapshot.due > 0)

  return (
    <Layout>
      <div className="stack">
        <p className="kicker">{profile.dailyMinutes} minute goal</p>
        <h1>Today</h1>
        <button className="button start" type="button" onClick={() => navigate('/session')}>
          {resume ? 'Resume today’s session' : 'Start today’s session'}
        </button>
        {resume ? (
          <button
            className="button ghost"
            type="button"
            onClick={() => {
              sessionStorage.removeItem(SESSION_KEY)
              navigate('/session')
            }}
          >
            Discard the paused session and start over
          </button>
        ) : null}
        <dl className="stats">
          <div>
            <dt>Reviews due</dt>
            <dd>{snapshot.due}</dd>
          </div>
          <div>
            <dt>New words today</dt>
            <dd>{snapshot.sessionNew}</dd>
          </div>
          <div>
            <dt>This sitting</dt>
            <dd>{snapshot.minutes ? `${snapshot.minutes} min` : 'Caught up'}</dd>
          </div>
          <div>
            <dt>Streak</dt>
            <dd>{study.meta.streak} {study.meta.streak === 1 ? 'day' : 'days'}</dd>
          </div>
          <div>
            <dt>Introduced</dt>
            <dd>{counts.introduced}</dd>
          </div>
          <div>
            <dt>Mastered</dt>
            <dd>{counts.mastered}</dd>
          </div>
          <div>
            <dt>Needs attention</dt>
            <dd>{counts.attention}</dd>
          </div>
        </dl>
        {newWaiting ? (
          <p className="note">Due reviews come first. New words wait until this sitting has room.</p>
        ) : null}
        {newCapIsHigh(cap) ? (
          <p className="note">
            This pace introduces about {cap} new words a day. That can become a heavy review load. A gentler pace is easier to keep.
          </p>
        ) : null}
        {snapshot.plan.length === 0 ? (
          <p className="lead">
            Nothing is due. You can <Link to="/session?extra=3">add 3 extra new words</Link> or try a{' '}
            <Link to="/drill">60-second recall</Link> of words you already started.
          </p>
        ) : null}
      </div>
    </Layout>
  )
}
