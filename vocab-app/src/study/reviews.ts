import { masteryOf, type MasteryInput } from '../srs/progress'
import { cardFromJson } from '../srs/scheduler'
import type { PlanReview } from '../srs/session'
import type { ReviewRecord } from '../vocab/types'

export function toPlanReview(record: ReviewRecord): PlanReview {
  const card = cardFromJson(record.cardJson)
  return {
    wordId: record.wordId,
    due: card.due.toISOString(),
    stability: card.stability,
    reps: card.reps,
    lapses: card.lapses,
    lastRating: record.lastRating,
    scheduledDays: card.scheduled_days,
  }
}

export function toMastery(record: ReviewRecord): MasteryInput {
  const card = cardFromJson(record.cardJson)
  return {
    reps: card.reps,
    lapses: card.lapses,
    scheduledDays: card.scheduled_days,
    state: card.state,
    lastRating: record.lastRating,
  }
}

export function masteryFor(record: ReviewRecord | undefined) {
  return masteryOf(record ? toMastery(record) : null)
}
