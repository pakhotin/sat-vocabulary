import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { ChoiceList } from './Diagnostic'
import { gradeChoice, gradeMeaning, gradeTyped, productionHasWord } from '../questions/grade'
import { expandPlan, emptyStats, type RunStep, type SessionStats } from '../questions/expand'
import { makeQuestion, type Question } from '../questions/generate'
import { isTypedQuestion, xpFor } from '../srs/progress'
import { cardFromJson, Rating, type Grade } from '../srs/scheduler'
import { makePlan } from '../study/plan'
import { useStudy } from '../study/context'
import { playTone } from '../sound'
import { silence, speak } from '../speech'
import type { AnswerResult, VocabularyWord } from '../vocab/types'

const SESSION_KEY = 'sat-vocab-session'
const SUMMARY_KEY = 'sat-vocab-summary'

interface SavedRun {
  id: string
  index: number
  queue: RunStep[]
  stats: SessionStats
}

const PHASE_LABEL: Record<RunStep['phase'], string> = {
  warmup: 'Warm-up',
  review: 'Review',
  new: 'New word',
  productive: 'Use the word',
  retry: 'Another look',
}

function IntroCard({
  word,
  audio,
  headingRef,
  onContinue,
}: {
  word: VocabularyWord
  audio: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
  onContinue: () => void
}) {
  return (
    <article className="card">
      <h2 ref={headingRef} tabIndex={-1}>
        <span className="word">{word.headword}</span>
      </h2>
      <p className="pos">
        {word.part_of_speech}
        {word.register ? ` · ${word.register}` : ''}
      </p>
      {audio ? (
        <button className="button ghost" type="button" onClick={() => speak(word.headword)}>
          Hear it
        </button>
      ) : null}
      <p>{word.primary_definition}</p>
      {word.example_sentences[0] ? <p className="example">{word.example_sentences[0].text}</p> : null}
      <details>
        <summary>More about this word</summary>
        {word.secondary_definitions.length ? <p>Also: {word.secondary_definitions.join('; ')}</p> : null}
        {word.usage_notes ? <p>{word.usage_notes}</p> : null}
        {word.mnemonic ? <p>Memory hook: {word.mnemonic}</p> : null}
        {word.etymology ? <p>Origin: {word.etymology}</p> : null}
      </details>
      <button className="button" type="button" onClick={onContinue}>
        Hide it and recall
      </button>
    </article>
  )
}

function phaseLabel(step: RunStep, queue: RunStep[], index: number): string {
  if (step.phase === 'new') {
    const intros = queue.filter((item) => item.phase === 'new' && item.mode === 'intro')
    const position = intros.findIndex((item) => item.wordId === step.wordId) + 1
    return `New word ${Math.max(position, 1)} of ${Math.max(intros.length, 1)}`
  }
  return `${PHASE_LABEL[step.phase]} · ${index + 1} of ${queue.length}`
}

export function Session() {
  const study = useStudy()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [run, setRun] = useState<SavedRun | null>(null)
  const [mode, setMode] = useState<'answer' | 'self' | 'feedback'>('answer')
  const [typed, setTyped] = useState('')
  const [choiceId, setChoiceId] = useState('')
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [selfPrompt, setSelfPrompt] = useState('')
  const [rated, setRated] = useState(false)
  const [interval, setInterval] = useState('')
  const [practiceAgain, setPracticeAgain] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [shaky, setShaky] = useState<string[]>([])
  const headingRef = useRef<HTMLHeadingElement>(null)
  const prior = useRef({ lapses: 0, lastRating: null as number | null })
  const intervened = useRef(new Set<string>())
  const booted = useRef(false)

  useEffect(() => {
    if (!study.ready || !study.profile || booted.current) return
    booted.current = true
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) {
      setRun(JSON.parse(saved) as SavedRun)
      return
    }
    const extra = Number(params.get('extra') || 0)
    const built = makePlan({
      words: study.words,
      reviews: study.reviews,
      profile: study.profile,
      meta: study.meta,
      extraNew: Number.isFinite(extra) ? extra : 0,
    })
    const queue = expandPlan(built.plan, study.words, study.profile)
    const next = { id: crypto.randomUUID(), index: 0, queue, stats: emptyStats() }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
    setRun(next)
  }, [params, study])

  const step = run && run.index < run.queue.length ? run.queue[run.index] : null
  const word = step ? study.wordById.get(step.wordId) : undefined
  const question = useMemo(() => {
    if (!step || !word || step.mode !== 'question' || !step.questionType || !study.profile) return null
    return makeQuestion(word, study.words, step.questionType)
  }, [step, word, study.profile, study.words])

  useEffect(() => {
    if (!step || !word) return
    const record = study.reviews.find((item) => item.wordId === word.id)
    const card = record ? cardFromJson(record.cardJson) : null
    prior.current = { lapses: card?.lapses ?? 0, lastRating: record?.lastRating ?? null }
    setMode('answer')
    setTyped('')
    setChoiceId('')
    setResult(null)
    setSelfPrompt('')
    setRated(false)
    setInterval('')
    setPracticeAgain(false)
    setActiveKey(null)
    headingRef.current?.focus()
    return () => silence()
    // Prior lapse count is captured when the card changes, not after this card is rated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.key])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!step || !question) return
      const target = event.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'
      if (event.key === 'Enter' && mode === 'answer' && !typing) {
        event.preventDefault()
        check()
      }
      if (!typing && mode === 'answer' && question.choices && ['1', '2', '3', '4'].includes(event.key)) {
        const choice = question.choices[Number(event.key) - 1]
        if (choice) setChoiceId(choice.id)
      }
      if (!typing && mode === 'feedback' && step.schedules && !rated && ['1', '2', '3', '4'].includes(event.key)) {
        const ratings: Record<string, Grade> = { '1': Rating.Again, '2': Rating.Hard, '3': Rating.Good, '4': Rating.Easy }
        void chooseRating(ratings[event.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function persist(next: SavedRun) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
    setRun(next)
  }

  function bump(stats: SessionStats, nextResult: AnswerResult, amount: number, introduced: boolean): SessionStats {
    return {
      correct: stats.correct + (nextResult === 'correct' ? 1 : 0),
      partial: stats.partial + (nextResult === 'partial' ? 1 : 0),
      incorrect: stats.incorrect + (nextResult === 'incorrect' ? 1 : 0),
      introduced: stats.introduced + (introduced ? 1 : 0),
      xp: stats.xp + amount,
      answered: stats.answered + 1,
    }
  }

  function settle(nextResult: AnswerResult) {
    if (!run || !step || !study.profile) return
    const amount = xpFor(nextResult, isTypedQuestion(step.questionType || ''))
    const stats = bump(run.stats, nextResult, amount, false)
    persist({ ...run, stats })
    if (step.phase === 'new' && !step.schedules && nextResult !== 'correct') {
      setShaky((current) => (current.includes(step.wordId) ? current : current.concat(step.wordId)))
    }
    setActiveKey(step.key)
    setResult(nextResult)
    setMode('feedback')
    const repeated = prior.current.lapses >= 1 || prior.current.lastRating === Rating.Again
    setPracticeAgain(nextResult === 'incorrect' && repeated && !intervened.current.has(step.wordId))
    void study.addXp(amount, nextResult === 'correct' && isTypedQuestion(step.questionType || ''))
    playTone(nextResult === 'incorrect' ? 'miss' : 'ok', study.profile.sound)
    if (study.profile.audio && word && nextResult !== 'correct') speak(word.headword)
  }

  function check() {
    if (!question || !word || !step) return
    if (question.type === 'word-to-meaning') {
      const graded = gradeMeaning(typed, word)
      if (graded.uncertain) {
        setSelfPrompt('The check is not sure. Did your phrase match the meaning?')
        setActiveKey(step.key)
        setMode('self')
        return
      }
      settle(graded.result)
      return
    }
    if (question.type === 'sentence-production') {
      if (!productionHasWord(typed, word)) {
        settle('incorrect')
        return
      }
      setSelfPrompt('The word is there. Does the sentence use its meaning?')
      setActiveKey(step.key)
      setMode('self')
      return
    }
    if (question.choices) {
      const selected = question.choices.find((choice) => choice.id === choiceId)
      settle(gradeChoice(selected?.correct))
      return
    }
    const graded = gradeTyped(typed, question.accepted, question.related)
    settle(graded.result)
  }

  async function chooseRating(rating: Grade) {
    if (!run || !step || !word || !result || rated) return
    setRated(true)
    const label = await study.rateWord({
      wordId: word.id,
      rating,
      result,
      questionType: step.questionType || 'definition-to-word',
      countsAsNew: step.countsAsNew,
    })
    setInterval(label)
    if (step.countsAsNew) {
      const stats = { ...run.stats, introduced: run.stats.introduced + 1 }
      persist({ ...run, stats })
    }
  }

  async function finish(current: SavedRun) {
    if (current.stats.answered > 0) await study.finishSession(current.id)
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.setItem(SUMMARY_KEY, JSON.stringify(current.stats))
    navigate('/summary', { state: current.stats })
  }

  function goNext() {
    if (!run || !step) return
    let queue = run.queue
    if (practiceAgain && result === 'incorrect') {
      intervened.current.add(step.wordId)
      const extra: RunStep[] = [
        {
          key: `${step.key}-retry-a`,
          phase: 'retry',
          wordId: step.wordId,
          mode: 'question',
          schedules: false,
          countsAsNew: false,
          questionType: 'word-to-meaning-choice',
        },
        {
          key: `${step.key}-retry-b`,
          phase: 'retry',
          wordId: step.wordId,
          mode: 'question',
          schedules: false,
          countsAsNew: false,
          questionType: 'definition-to-word',
        },
      ]
      queue = [...queue.slice(0, run.index + 1), ...extra, ...queue.slice(run.index + 1)]
    }
    const next = { ...run, queue, index: run.index + 1 }
    if (next.index >= next.queue.length) {
      void finish(next)
      return
    }
    setMode('answer')
    setTyped('')
    setChoiceId('')
    setResult(null)
    setSelfPrompt('')
    setRated(false)
    setInterval('')
    setPracticeAgain(false)
    setActiveKey(null)
    persist(next)
  }

  if (!run || !study.profile) {
    return (
      <Layout quiet>
        <p role="status">Preparing today’s words…</p>
      </Layout>
    )
  }

  if (!step || !word) {
    return (
      <Layout>
        <div className="stack">
          <h1>You’re caught up</h1>
          <p className="lead">Nothing is due, and today’s new-word limit is filled. A short session tomorrow keeps the words.</p>
          <button className="button" type="button" onClick={() => navigate('/')}>
            Back to today
          </button>
        </div>
      </Layout>
    )
  }

  const viewMode = activeKey === step.key ? mode : 'answer'
  const viewResult = activeKey === step.key ? result : null
  const repeatedMiss = viewResult === 'incorrect' && (prior.current.lapses >= 1 || prior.current.lastRating === Rating.Again)
  const suggestion = suggested(viewResult, shaky.includes(word.id))

  return (
    <Layout quiet>
      <div className="stack">
        <div className="session-top">
          <p className="kicker">{phaseLabel(step, run.queue, run.index)}</p>
          <button className="button ghost" type="button" onClick={() => void finish(run)}>
            End session
          </button>
        </div>
        <div
          className="bar"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={run.queue.length}
          aria-valuenow={run.index + 1}
          aria-label={`Card ${run.index + 1} of ${run.queue.length}`}
        >
          <span style={{ width: `${(run.index / run.queue.length) * 100}%` }} />
        </div>
        {step.mode === 'intro' ? (
          <IntroCard word={word} audio={study.profile.audio} headingRef={headingRef} onContinue={goNext} />
        ) : question ? (
          <QuestionCard
            question={question}
            headingRef={headingRef}
            mode={viewMode}
            typed={typed}
            setTyped={setTyped}
            choiceId={choiceId}
            setChoiceId={setChoiceId}
            onCheck={check}
            onMiss={() => settle('incorrect')}
            audio={study.profile.audio}
          />
        ) : null}
        {viewMode === 'self' ? (
          <div className="feedback" role="status">
            <p>{selfPrompt}</p>
            <div className="actions">
              <button className="button" type="button" onClick={() => settle('correct')}>
                Yes
              </button>
              <button className="button secondary" type="button" onClick={() => settle('partial')}>
                Partly
              </button>
              <button className="button secondary" type="button" onClick={() => settle('incorrect')}>
                No
              </button>
            </div>
          </div>
        ) : null}
        {viewMode === 'feedback' && viewResult && question ? (
          <Feedback
            result={viewResult}
            question={question}
            repeated={repeatedMiss}
            practiceAgain={practiceAgain}
            setPracticeAgain={setPracticeAgain}
            compare={word.compare_with
              .map((id) => study.wordById.get(id))
              .filter((item): item is NonNullable<typeof item> => Boolean(item))}
          />
        ) : null}
        {viewMode === 'feedback' && step.schedules && viewResult ? (
          <div className="stack">
            <p id="rating-hint">
              Suggested: {ratingName(suggestion)}
              {viewResult === 'partial' ? ' — the recall was close.' : ''}
            </p>
            <div className="ratings" role="group" aria-describedby="rating-hint" aria-label="How hard was it to remember?">
              <RatingButton label="Again" hint="Forgotten" value={Rating.Again} suggested={suggestion} disabled={rated} onPick={chooseRating} />
              <RatingButton label="Hard" hint="Uncertain" value={Rating.Hard} suggested={suggestion} disabled={rated} onPick={chooseRating} />
              <RatingButton label="Good" hint="Recalled" value={Rating.Good} suggested={suggestion} disabled={rated} onPick={chooseRating} />
              <RatingButton label="Easy" hint="Instant" value={Rating.Easy} suggested={suggestion} disabled={rated} onPick={chooseRating} />
            </div>
            {interval ? <p role="status">Next review {interval}.</p> : null}
            <button className="button" type="button" disabled={!rated} onClick={goNext}>
              Next
            </button>
          </div>
        ) : null}
        {viewMode === 'feedback' && !step.schedules ? (
          <button className="button" type="button" onClick={goNext}>
            Next
          </button>
        ) : null}
      </div>
    </Layout>
  )

  function suggested(current: AnswerResult | null, wasShaky: boolean): Grade {
    if (current === 'incorrect') return Rating.Again
    if (current === 'partial' || wasShaky) return Rating.Hard
    return Rating.Good
  }
}

function ratingName(rating: Grade): string {
  if (rating === Rating.Again) return 'Again'
  if (rating === Rating.Hard) return 'Hard'
  if (rating === Rating.Easy) return 'Easy'
  return 'Good'
}

function RatingButton({
  label,
  hint,
  value,
  suggested,
  disabled,
  onPick,
}: {
  label: string
  hint: string
  value: Grade
  suggested: Grade
  disabled: boolean
  onPick: (rating: Grade) => void
}) {
  return (
    <button className={value === suggested ? 'rating suggested' : 'rating'} type="button" disabled={disabled} onClick={() => onPick(value)}>
      <span>{label}</span>
      <small>{hint}</small>
    </button>
  )
}

function QuestionCard({
  question,
  headingRef,
  mode,
  typed,
  setTyped,
  choiceId,
  setChoiceId,
  onCheck,
  onMiss,
  audio,
}: {
  question: Question
  headingRef: RefObject<HTMLHeadingElement | null>
  mode: 'answer' | 'self' | 'feedback'
  typed: string
  setTyped: (value: string) => void
  choiceId: string
  setChoiceId: (value: string) => void
  onCheck: () => void
  onMiss: () => void
  audio: boolean
}) {
  const showChoices = Boolean(question.choices)
  return (
    <article className="card">
      <h2 ref={headingRef} tabIndex={-1}>
        {question.type === 'word-to-meaning' || question.type === 'listening' ? <span className="word">{question.prompt}</span> : question.prompt}
      </h2>
      {question.detail ? <p>{question.detail}</p> : null}
      {question.speakText && audio ? (
        <button className="button ghost" type="button" onClick={() => speak(question.speakText || '')}>
          Hear it
        </button>
      ) : null}
      {showChoices && question.choices ? (
        <ChoiceList choices={question.choices} choiceId={choiceId} checked={mode !== 'answer'} onSelect={setChoiceId} />
      ) : (
        <label className="field">
          <span className="sr-only">Your answer</span>
          <textarea
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            rows={question.type === 'sentence-production' ? 3 : 2}
            disabled={mode !== 'answer'}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Your answer"
          />
        </label>
      )}
      {mode === 'answer' ? (
        <div className="actions">
          <button className="button" type="button" onClick={onCheck} disabled={showChoices ? !choiceId : !typed.trim()}>
            Check
          </button>
          {showChoices ? null : (
            <button className="button secondary" type="button" onClick={onMiss}>
              I need to see it
            </button>
          )}
        </div>
      ) : null}
    </article>
  )
}

function Feedback({
  result,
  question,
  repeated,
  practiceAgain,
  setPracticeAgain,
  compare,
}: {
  result: AnswerResult
  question: Question
  repeated: boolean
  practiceAgain: boolean
  setPracticeAgain: (value: boolean) => void
  compare: { headword: string; primary_definition: string }[]
}) {
  const title = result === 'correct' ? 'Retrieved' : result === 'partial' ? 'Almost' : 'Not this time'
  const correctChoice = question.choices?.find((choice) => choice.correct)
  const answer = correctChoice?.text || question.accepted[0]
  return (
    <div className={`feedback ${result}`} role="status">
      <p>
        <strong>{title}.</strong> {question.type === 'word-to-meaning' ? question.explanation : `Answer: ${answer}.`}
      </p>
      {question.type !== 'word-to-meaning' ? <p>{question.explanation}</p> : null}
      {question.example ? <p className="example">{question.example}</p> : null}
      {result !== 'correct' && question.confusion ? <p>Easy to mix up: {question.confusion}</p> : null}
      {result !== 'correct' && compare.length ? (
        <ul>
          {compare.map((item) => (
            <li key={item.headword}>
              <strong>{item.headword}:</strong> {item.primary_definition}
            </li>
          ))}
        </ul>
      ) : null}
      {repeated ? (
        <div className="note">
          <p>This one has slipped before. A simpler hook: {question.explanation}</p>
          <label className="check">
            <input type="checkbox" checked={practiceAgain} onChange={(event) => setPracticeAgain(event.target.checked)} />
            Add two short practice questions before moving on
          </label>
        </div>
      ) : null}
    </div>
  )
}
