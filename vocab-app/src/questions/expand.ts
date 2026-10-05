import type { Profile, QuestionType, VocabularyWord } from '../vocab/types'
import type { SessionStep } from '../srs/session'
import { chooseQuestionType } from './generate'

export interface SessionStats {
  correct: number
  partial: number
  incorrect: number
  introduced: number
  xp: number
  answered: number
}

export function emptyStats(): SessionStats {
  return { correct: 0, partial: 0, incorrect: 0, introduced: 0, xp: 0, answered: 0 }
}

export interface RunStep {
  key: string
  phase: 'warmup' | 'review' | 'new' | 'productive' | 'retry'
  wordId: string
  mode: 'intro' | 'question'
  schedules: boolean
  countsAsNew: boolean
  questionType?: QuestionType
}

export function expandPlan(plan: SessionStep[], words: VocabularyWord[], profile: Profile, random: () => number = Math.random): RunStep[] {
  const known = new Set(words.map((word) => word.id))
  const steps: RunStep[] = []
  for (const step of plan) {
    if (!known.has(step.wordId)) continue
    if (step.phase === 'new') {
      const meaning: QuestionType = profile.inputMode === 'typing' ? 'word-to-meaning' : 'word-to-meaning-choice'
      const recall: QuestionType = profile.inputMode === 'choice' ? 'cloze' : 'definition-to-word'
      steps.push({
        key: `${step.id}-intro`,
        phase: 'new',
        wordId: step.wordId,
        mode: 'intro',
        schedules: false,
        countsAsNew: false,
      })
      steps.push({
        key: `${step.id}-meaning`,
        phase: 'new',
        wordId: step.wordId,
        mode: 'question',
        schedules: false,
        countsAsNew: false,
        questionType: meaning,
      })
      steps.push({
        key: `${step.id}-recall`,
        phase: 'new',
        wordId: step.wordId,
        mode: 'question',
        schedules: true,
        countsAsNew: true,
        questionType: recall,
      })
      continue
    }
    if (step.phase === 'productive') {
      steps.push({
        key: step.id,
        phase: 'productive',
        wordId: step.wordId,
        mode: 'question',
        schedules: false,
        countsAsNew: false,
        questionType: 'sentence-production',
      })
      continue
    }
    steps.push({
      key: step.id,
      phase: step.phase,
      wordId: step.wordId,
      mode: 'question',
      schedules: true,
      countsAsNew: false,
      questionType: chooseQuestionType(wordFor(words, step.wordId), profile, step.phase === 'warmup' ? 'warmup' : 'review', random),
    })
  }
  return steps
}

function wordFor(words: VocabularyWord[], id: string): VocabularyWord {
  const found = words.find((word) => word.id === id)
  if (!found) throw new Error(`Missing word ${id}`)
  return found
}
