import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useStudy } from '../study/context'
import { defaultProfile, type EducationLevel, type InputMode, type Minutes, type Pace } from '../vocab/types'

export function Onboarding() {
  const study = useStudy()
  const navigate = useNavigate()
  const initial = study.profile ?? defaultProfile()
  const [educationLevel, setEducationLevel] = useState<EducationLevel>(initial.educationLevel)
  const [dailyMinutes, setDailyMinutes] = useState<Minutes>(initial.dailyMinutes)
  const [pace, setPace] = useState<Pace>(initial.pace)
  const [inputMode, setInputMode] = useState<InputMode>(initial.inputMode)
  const [audio, setAudio] = useState(initial.audio)

  async function save(diagnosticDone: boolean) {
    await study.saveProfile({
      ...initial,
      educationLevel,
      dailyMinutes,
      pace,
      inputMode,
      audio,
      diagnosticDone,
      createdAt: initial.createdAt || new Date().toISOString(),
    })
    navigate(diagnosticDone ? '/' : '/diagnostic')
  }

  return (
    <Layout quiet>
      <div className="stack">
        <p className="kicker">A few minutes a day</p>
        <h1>Remember words for months, not for one quiz.</h1>
        <p className="lead">
          You will try to recall a word before the answer appears. Missed words return sooner. Words you know wait longer.
        </p>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault()
            void save(false)
          }}
        >
          <fieldset>
            <legend>Education, if you want to say</legend>
            <div className="choices">
              {(
                [
                  ['', 'Skip'],
                  ['middle', 'Middle school'],
                  ['high', 'High school'],
                  ['college', 'College'],
                  ['adult', 'Adult'],
                ] as const
              ).map(([value, label]) => (
                <label key={label} className="choice">
                  <input
                    type="radio"
                    name="education"
                    checked={educationLevel === value}
                    onChange={() => setEducationLevel(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Daily study time</legend>
            <div className="choices">
              {([5, 10, 15, 25] as const).map((minutes) => (
                <label key={minutes} className="choice">
                  <input
                    type="radio"
                    name="minutes"
                    checked={dailyMinutes === minutes}
                    onChange={() => setDailyMinutes(minutes)}
                  />
                  {minutes} min
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Pace</legend>
            <div className="choices">
              {(
                [
                  ['gentle', 'Gentle'],
                  ['standard', 'Standard'],
                  ['intensive', 'Intensive'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="choice">
                  <input type="radio" name="pace" checked={pace === value} onChange={() => setPace(value)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>How do you want to answer?</legend>
            <div className="choices">
              {(
                [
                  ['typing', 'Typing'],
                  ['choice', 'Multiple choice'],
                  ['mixed', 'A mixture'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="choice">
                  <input type="radio" name="mode" checked={inputMode === value} onChange={() => setInputMode(value)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="check">
            <input type="checkbox" checked={audio} onChange={(event) => setAudio(event.target.checked)} />
            Play pronunciation
          </label>
          <button className="button" type="submit">
            Check what I already know
          </button>
          <button className="button secondary" type="button" onClick={() => void save(true)}>
            Skip placement and start
          </button>
        </form>
      </div>
    </Layout>
  )
}
