import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { ChoiceList } from './Diagnostic'
import { makeQuestion } from '../questions/generate'
import { xpFor } from '../srs/progress'
import { useStudy } from '../study/context'
import { toMastery } from '../study/reviews'

export function Drill() {
  const study = useStudy()
  const learned = useMemo(
    () => study.words.filter((word) => (study.reviews.find((review) => review.wordId === word.id) ? toMastery(study.reviews.find((review) => review.wordId === word.id)!).reps > 0 : false)),
    [study.reviews, study.words],
  )
  const [index, setIndex] = useState(0)
  const [choiceId, setChoiceId] = useState('')
  const [correct, setCorrect] = useState(0)
  const [checked, setChecked] = useState(false)
  const [left, setLeft] = useState(60)
  const [running, setRunning] = useState(false)
  const granted = useRef(false)
  const word = learned[index % Math.max(learned.length, 1)]
  const question = useMemo(() => (word && running ? makeQuestion(word, study.words, 'word-to-meaning-choice') : null), [running, study.words, word])

  useEffect(() => {
    if (!running || left <= 0) return
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [left, running])

  useEffect(() => {
    if (left !== 0 || !running || granted.current) return
    granted.current = true
    setRunning(false)
    void study.addXp(xpFor('correct', false) * correct, false)
  }, [correct, left, running, study])

  if (learned.length < 4) {
    return (
      <Layout>
        <div className="stack">
          <h1>60-second recall</h1>
          <p>Learn a few words in a normal session first. This drill only uses words you have already studied, and it does not change their review dates.</p>
          <Link className="button" to="/">
            Back to today
          </Link>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="stack">
        <h1>60-second recall</h1>
        <p className="kicker" aria-live="polite">
          {left} seconds · {correct} retrieved
        </p>
        {!running && left === 60 ? (
          <button className="button" type="button" onClick={() => setRunning(true)}>
            Start
          </button>
        ) : null}
        {running && question && word ? (
          <>
            <h2 className="word">{word.headword}</h2>
            <ChoiceList choices={question.choices || []} choiceId={choiceId} checked={checked} onSelect={setChoiceId} />
            <button
              className="button"
              type="button"
              disabled={!choiceId || checked}
              onClick={() => {
                const hit = question.choices?.find((choice) => choice.id === choiceId)?.correct
                if (hit) setCorrect((value) => value + 1)
                setChecked(true)
                window.setTimeout(() => {
                  setIndex((value) => value + 1)
                  setChoiceId('')
                  setChecked(false)
                }, 400)
              }}
            >
              Check
            </button>
          </>
        ) : null}
        {!running && left === 0 ? (
          <p className="lead">You retrieved {correct} {correct === 1 ? 'word' : 'words'}. Review dates stayed the same.</p>
        ) : null}
        <Link to="/progress">Back to progress</Link>
      </div>
    </Layout>
  )
}
