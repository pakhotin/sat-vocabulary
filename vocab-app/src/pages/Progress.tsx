import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { localISODate } from '../srs/dates'
import { earnedBadges, MILESTONES, progressCounts } from '../srs/progress'
import { useStudy } from '../study/context'
import { toMastery } from '../study/reviews'
import type { VocabularyWord } from '../vocab/types'

const PLOTS = [1, 25, 50, 100, 250, 500, 750, 1000]

function wordOfDay(words: VocabularyWord[]): VocabularyWord | undefined {
  if (!words.length) return undefined
  const pool = words.filter((word) => word.etymology || word.usage_notes)
  const source = pool.length ? pool : words
  const today = localISODate(new Date())
  let hash = 0
  for (const char of today) hash = (Math.imul(hash, 33) + char.charCodeAt(0)) >>> 0
  return source[hash % source.length]
}

export function Progress() {
  const study = useStudy()
  const counts = progressCounts(study.reviews.map(toMastery))
  const badges = earnedBadges({
    mastered: counts.mastered,
    streak: study.meta.streak,
    typedCorrect: study.meta.typedCorrect,
    sessions: study.meta.sessionsCompleted,
    usedFreeze: study.meta.freezeEverUsed,
  })
  const feature = wordOfDay(study.words)
  const grown = PLOTS.filter((threshold) => counts.mastered >= threshold).length

  return (
    <Layout>
      <div className="stack">
        <h1>Progress</h1>
        <section className="card" aria-label="Progress garden">
          <h2>Garden</h2>
          <p>
            {grown} of {PLOTS.length} plots are growing. Each plot marks words you can recall weeks later.
          </p>
          <div className="garden">
            {PLOTS.map((threshold) => {
              const alive = counts.mastered >= threshold
              return (
                <div key={threshold} className={alive ? 'plot grown' : 'plot'}>
                  <span className="plant" aria-hidden="true" />
                  <span>{threshold === 1 ? 'First' : threshold}</span>
                </div>
              )
            })}
          </div>
        </section>
        <section>
          <h2>Milestones</h2>
          <ul className="badges">
            {MILESTONES.map((milestone) => (
              <li key={milestone} className={counts.mastered >= milestone ? 'badge earned' : 'badge'}>
                {counts.mastered >= milestone ? 'Reached' : 'Ahead'}: {milestone} mastered
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Badges</h2>
          {badges.length ? (
            <ul className="badges">
              {badges.map((badge) => (
                <li key={badge} className="badge earned">
                  {badge}
                </li>
              ))}
            </ul>
          ) : (
            <p>Badges show up after real review, not after time spent.</p>
          )}
        </section>
        {feature ? (
          <section className="card">
            <h2>Word for today</h2>
            <p className="word">{feature.headword}</p>
            <p>{feature.primary_definition}</p>
            {feature.etymology ? <p>{feature.etymology}</p> : null}
            {!feature.etymology && feature.usage_notes ? <p>{feature.usage_notes}</p> : null}
          </section>
        ) : null}
        <section>
          <h2>Saved words</h2>
          {study.meta.favorites.length ? (
            <ul>
              {study.meta.favorites.map((id) => {
                const word = study.wordById.get(id)
                return word ? (
                  <li key={id}>
                    <Link to={`/word/${id}`}>{word.headword}</Link>
                  </li>
                ) : null
              })}
            </ul>
          ) : (
            <p>Save a word from its page when you want it in a personal list.</p>
          )}
        </section>
        <Link className="button secondary" to="/drill">
          60-second recall
        </Link>
      </div>
    </Layout>
  )
}
