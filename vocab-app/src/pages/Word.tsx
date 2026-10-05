import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { formatInterval } from '../srs/scheduler'
import { cardFromJson } from '../srs/scheduler'
import { useStudy } from '../study/context'
import { speak } from '../speech'

export function WordPage() {
  const { id = '' } = useParams()
  const study = useStudy()
  const word = study.wordById.get(id)
  const review = study.reviews.find((item) => item.wordId === id)
  if (!word) {
    return (
      <Layout>
        <p>That word is not in the current list.</p>
        <Link to="/progress">Back to progress</Link>
      </Layout>
    )
  }
  const saved = study.meta.favorites.includes(word.id)
  const due = review ? formatInterval(new Date(), cardFromJson(review.cardJson).due) : 'not scheduled yet'

  return (
    <Layout>
      <article className="stack">
        <p className="kicker">{word.part_of_speech}{word.register ? ` · ${word.register}` : ''}</p>
        <h1 className="word">{word.headword}</h1>
        {study.profile?.audio ? (
          <button className="button ghost" type="button" onClick={() => speak(word.headword)}>
            Hear it
          </button>
        ) : null}
        <p>{word.primary_definition}</p>
        {word.example_sentences[0] ? <p className="example">{word.example_sentences[0].text}</p> : null}
        <p>Next review {due}.</p>
        <details>
          <summary>More</summary>
          {word.secondary_definitions.length ? <p>Also: {word.secondary_definitions.join('; ')}</p> : null}
          {word.usage_notes ? <p>{word.usage_notes}</p> : null}
          {word.common_confusions.length ? <p>Easy to mix up: {word.common_confusions.join(' ')}</p> : null}
          {word.mnemonic ? <p>Memory hook: {word.mnemonic}</p> : null}
          {word.etymology ? <p>Origin: {word.etymology}</p> : null}
          {word.synonyms.length ? <p>Synonyms: {word.synonyms.join(', ')}</p> : null}
        </details>
        <button className="button secondary" type="button" onClick={() => void study.toggleFavorite(word.id)}>
          {saved ? 'Remove from saved words' : 'Save this word'}
        </button>
        <Link to="/progress">Back to progress</Link>
      </article>
    </Layout>
  )
}
