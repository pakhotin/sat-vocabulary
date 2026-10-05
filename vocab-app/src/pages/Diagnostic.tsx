import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { diagnosticChoices, type Choice } from '../questions/generate'
import { useStudy } from '../study/context'
import type { VocabularyWord } from '../vocab/types'

function sampleWords(words: VocabularyWord[], count = 12): VocabularyWord[] {
  if (words.length <= count) return words
  const step = Math.max(1, Math.floor(words.length / count))
  return Array.from({ length: count }, (_, index) => words[Math.min(words.length - 1, index * step)])
}

export function Diagnostic() {
  const study = useStudy()
  const navigate = useNavigate()
  const words = useMemo(() => sampleWords(study.words), [study.words])
  const [index, setIndex] = useState(0)
  const [choiceId, setChoiceId] = useState('')
  const [checked, setChecked] = useState(false)
  const [known, setKnown] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const current = words[index]
  const choices = useMemo(() => (current ? diagnosticChoices(current, study.words, Math.random) : []), [current, study.words])

  if (!current && !done) {
    return (
      <Layout quiet>
        <p>No words are loaded yet.</p>
      </Layout>
    )
  }

  async function finish(ids: string[]) {
    await study.markKnown(ids)
    if (study.profile) await study.saveProfile({ ...study.profile, diagnosticDone: true })
    setDone(true)
  }

  function submit() {
    if (!current || checked) return
    const correct = choices.find((choice) => choice.id === choiceId)?.correct
    const nextKnown = correct ? [...known, current.id] : known
    setKnown(nextKnown)
    setChecked(true)
    if (!correct) return
  }

  function continueNext() {
    if (!current) return
    if (index + 1 >= words.length) {
      void finish(known)
      return
    }
    setIndex(index + 1)
    setChoiceId('')
    setChecked(false)
  }

  if (done) {
    return (
      <Layout quiet>
        <div className="stack">
          <h1>Placement done</h1>
          <p className="lead">
            You already knew {known.length} of {words.length}. Those words will come back later for a check instead of filling today’s new-word slots.
          </p>
          <button className="button" type="button" onClick={() => navigate('/')}>
            Go to today
          </button>
        </div>
      </Layout>
    )
  }

  if (!current) return null

  return (
    <Layout quiet>
      <div className="stack">
        <p className="kicker">
          Placement {index + 1} of {words.length}
        </p>
        <h1>Which meaning fits “{current.headword}”?</h1>
        <ChoiceList choices={choices} choiceId={choiceId} checked={checked} onSelect={setChoiceId} />
        {checked ? (
          <div className={choices.find((choice) => choice.id === choiceId)?.correct ? 'feedback correct' : 'feedback incorrect'} role="status">
            <p>
              <strong>{current.headword}.</strong> {current.primary_definition}
            </p>
            {current.example_sentences[0] ? <p className="example">{current.example_sentences[0].text}</p> : null}
          </div>
        ) : null}
        <div className="actions">
          {checked ? (
            <button className="button" type="button" onClick={continueNext}>
              {index + 1 >= words.length ? 'See the result' : 'Next word'}
            </button>
          ) : (
            <button className="button" type="button" disabled={!choiceId} onClick={submit}>
              Check
            </button>
          )}
          <button
            className="button ghost"
            type="button"
            onClick={() => {
              if (study.profile) void study.saveProfile({ ...study.profile, diagnosticDone: true }).then(() => navigate('/'))
            }}
          >
            Skip the rest
          </button>
        </div>
      </div>
    </Layout>
  )
}

export function ChoiceList({
  choices,
  choiceId,
  checked,
  onSelect,
}: {
  choices: Choice[]
  choiceId: string
  checked: boolean
  onSelect: (id: string) => void
}) {
  return (
    <div className="choices" role="radiogroup" aria-label="Answer choices">
      {choices.map((choice, index) => {
        const selected = choice.id === choiceId
        return (
          <label key={choice.id} className={selected ? 'choice selected' : 'choice'}>
            <input
              type="radio"
              name="choice"
              value={choice.id}
              checked={selected}
              onChange={() => onSelect(choice.id)}
              disabled={checked}
            />
            <span className="choice-key" aria-hidden="true">
              {index + 1}
            </span>
            <span>{choice.text}</span>
            {checked && choice.correct ? <span className="flag">Correct answer</span> : null}
            {checked && selected && !choice.correct ? <span className="flag">Your choice</span> : null}
          </label>
        )
      })}
    </div>
  )
}
