import { useState } from 'react'
import { Layout } from '../components/Layout'
import { downloadText } from '../download'
import { dailyNewCap, newCapIsHigh } from '../srs/progress'
import { useStudy } from '../study/context'
import type { InputMode, Minutes, Pace, Profile, QuestionWeights } from '../vocab/types'

export function Settings() {
  const study = useStudy()
  const profile = study.profile
  const [message, setMessage] = useState('')
  const [fault, setFault] = useState('')
  if (!profile) return null
  const current: Profile = profile
  const cap = dailyNewCap(current.dailyMinutes, current.pace)

  async function save(partial: Partial<Profile>) {
    await study.saveProfile({ ...current, ...partial, id: 'local' } as Profile)
    setMessage('Saved.')
  }

  return (
    <Layout>
      <div className="stack">
        <h1>Settings</h1>
        <fieldset>
          <legend>Daily time</legend>
          <div className="choices">
            {([5, 10, 15, 25] as const).map((minutes) => (
              <label key={minutes} className="choice">
                <input
                  type="radio"
                  name="minutes"
                  checked={profile.dailyMinutes === minutes}
                  onChange={() => void save({ dailyMinutes: minutes as Minutes })}
                />
                {minutes} min
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Pace</legend>
          <div className="choices">
            {(['gentle', 'standard', 'intensive'] as const).map((pace) => (
              <label key={pace} className="choice">
                <input type="radio" name="pace" checked={profile.pace === pace} onChange={() => void save({ pace: pace as Pace })} />
                {pace}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Answers</legend>
          <div className="choices">
            {(['typing', 'choice', 'mixed'] as const).map((mode) => (
              <label key={mode} className="choice">
                <input
                  type="radio"
                  name="input"
                  checked={profile.inputMode === mode}
                  onChange={() => void save({ inputMode: mode as InputMode })}
                />
                {mode}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="check">
          <input type="checkbox" checked={profile.audio} onChange={(event) => void save({ audio: event.target.checked })} />
          Pronunciation
        </label>
        <label className="check">
          <input type="checkbox" checked={profile.sound} onChange={(event) => void save({ sound: event.target.checked })} />
          Sound effects
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={profile.reducedMotion}
            onChange={(event) => void save({ reducedMotion: event.target.checked })}
          />
          Reduce motion
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={profile.streakProtection}
            onChange={(event) => void save({ streakProtection: event.target.checked })}
          />
          Streak protection for one missed day
        </label>
        <fieldset>
          <legend>Text size</legend>
          <div className="choices">
            {[
              [0.9, 'Smaller'],
              [1, 'Default'],
              [1.15, 'Large'],
              [1.35, 'Larger'],
            ].map(([scale, label]) => (
              <label key={label} className="choice">
                <input
                  type="radio"
                  name="font"
                  checked={profile.fontScale === scale}
                  onChange={() => void save({ fontScale: Number(scale) })}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Question mix</legend>
          <p>Higher numbers appear more often. Typed recall stays available even in choice mode.</p>
          {Object.entries(profile.weights).map(([key, value]) => (
            <label key={key} className="field">
              {key}
              <input
                type="number"
                min={0}
                max={10}
                value={value}
                onChange={(event) => {
                  const weights = { ...profile.weights, [key]: Number(event.target.value) } as QuestionWeights
                  void save({ weights })
                }}
              />
            </label>
          ))}
        </fieldset>
        {newCapIsHigh(cap) ? (
          <p className="note">About {cap} new words a day will create a heavy review load later.</p>
        ) : (
          <p>Today’s new-word cap is about {cap}, after reviews.</p>
        )}
        <div className="actions">
          <button className="button secondary" type="button" onClick={() => downloadText('vocab-progress.json', study.exportProgress(false))}>
            Export progress
          </button>
          <button className="button secondary" type="button" onClick={() => downloadText('vocab-progress-anonymous.json', study.exportProgress(true))}>
            Export anonymized progress
          </button>
        </div>
        <label className="field">
          Import a progress backup
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              try {
                await study.importProgress(await file.text())
                setFault('')
                setMessage('Progress restored on this device.')
              } catch (caught) {
                setFault(caught instanceof Error ? caught.message : 'Could not read that file.')
              }
            }}
          />
        </label>
        <button
          className="button ghost"
          type="button"
          onClick={() => {
            if (window.confirm('Erase review history on this device? Export a backup first if you might want it.')) {
              void study.resetProgress()
              setMessage('Review history cleared. Saved words were kept.')
            }
          }}
        >
          Reset review history
        </button>
        {message ? <p role="status">{message}</p> : null}
        {fault ? <p role="alert">{fault}</p> : null}
      </div>
    </Layout>
  )
}
