import type { Pace } from '../vocab/types'
import { dailyNewCap } from './progress'

export interface PlanWord {
  id: string
  headword: string
  difficulty: number
}

export interface PlanReview {
  wordId: string
  due: string
  stability: number
  reps: number
  lapses: number
  lastRating: number | null
  scheduledDays: number
}

export interface SessionStep {
  id: string
  phase: 'warmup' | 'review' | 'new' | 'productive'
  wordId: string
  schedules: boolean
}

const WARMUP_SECONDS = 20
const REVIEW_SECONDS = 25
const NEW_SECONDS = 50
const PRODUCTIVE_SECONDS = 40

export function estimateSessionMinutes(plan: SessionStep[]): number {
  let seconds = 0
  for (const step of plan) {
    if (step.phase === 'warmup') seconds += WARMUP_SECONDS
    else if (step.phase === 'review') seconds += REVIEW_SECONDS
    else if (step.phase === 'new') seconds += NEW_SECONDS
    else seconds += PRODUCTIVE_SECONDS
  }
  if (seconds === 0) return 0
  return Math.max(1, Math.round(seconds / 60))
}

function pickNew(words: PlanWord[], known: Set<string>, count: number, pace: Pace): PlanWord[] {
  const pool = words.filter((word) => !known.has(word.id))
  pool.sort((a, b) => {
    if (pace === 'gentle') return a.difficulty - b.difficulty || a.headword.localeCompare(b.headword)
    if (pace === 'intensive') return b.difficulty - a.difficulty || a.headword.localeCompare(b.headword)
    return a.headword.localeCompare(b.headword)
  })
  const buckets = new Map<string, PlanWord[]>()
  for (const word of pool) {
    const key = word.headword.toLowerCase().match(/[a-z]/)?.[0] ?? 'zzz'
    const list = buckets.get(key) ?? []
    list.push(word)
    buckets.set(key, list)
  }
  const mixed: PlanWord[] = []
  const keys = [...buckets.keys()].sort()
  while (mixed.length < count) {
    let added = false
    for (const key of keys) {
      const list = buckets.get(key)
      if (!list?.length) continue
      const next = list.shift()
      if (next) mixed.push(next)
      added = true
      if (mixed.length >= count) break
    }
    if (!added) break
  }
  return mixed
}

export function buildSessionPlan(input: {
  words: PlanWord[]
  reviews: PlanReview[]
  now: Date
  minutes: number
  pace: Pace
  newWordsAlreadyToday: number
  extraNew?: number
}): SessionStep[] {
  const budget = Math.max(60, input.minutes * 60)
  let used = 0
  const steps: SessionStep[] = []
  const due = input.reviews
    .filter((review) => review.reps > 0 && new Date(review.due).getTime() <= input.now.getTime())
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())

  const warmup = due
    .filter((review) => review.stability >= 5 && review.lastRating !== 1)
    .sort((a, b) => b.stability - a.stability)
    .slice(0, 3)

  const seen = new Set<string>()
  for (const review of warmup) {
    if (used + WARMUP_SECONDS > budget && steps.length > 0) break
    steps.push({ id: `warmup-${review.wordId}`, phase: 'warmup', wordId: review.wordId, schedules: true })
    used += WARMUP_SECONDS
    seen.add(review.wordId)
  }

  for (const review of due) {
    if (seen.has(review.wordId)) continue
    if (used + REVIEW_SECONDS > budget && steps.length > 0) break
    steps.push({ id: `review-${review.wordId}`, phase: 'review', wordId: review.wordId, schedules: true })
    used += REVIEW_SECONDS
    seen.add(review.wordId)
  }

  const cap = Math.max(0, dailyNewCap(input.minutes, input.pace) - input.newWordsAlreadyToday + (input.extraNew ?? 0))
  const known = new Set(input.reviews.filter((review) => review.reps > 0).map((review) => review.wordId))
  for (const word of pickNew(input.words, known, cap, input.pace)) {
    if (used + NEW_SECONDS > budget) break
    steps.push({ id: `new-${word.id}`, phase: 'new', wordId: word.id, schedules: true })
    used += NEW_SECONDS
  }

  const practice = steps.filter((step) => step.phase !== 'productive')
  if (practice.length >= 3) {
    const count = practice.length >= 8 && used + PRODUCTIVE_SECONDS <= budget ? 2 : 1
    if (used + PRODUCTIVE_SECONDS <= budget + 20) {
      for (let index = 0; index < count; index += 1) {
        const wordId = practice[practice.length - 1 - index]?.wordId
        if (!wordId) continue
        steps.push({ id: `productive-${wordId}-${index}`, phase: 'productive', wordId, schedules: false })
      }
    }
  }
  return steps
}

export function dueCount(reviews: PlanReview[], now: Date): number {
  return reviews.filter((review) => review.reps > 0 && new Date(review.due).getTime() <= now.getTime()).length
}
