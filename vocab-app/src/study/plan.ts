import { localISODate } from '../srs/dates'
import { newWordsOnDate } from '../srs/progress'
import { buildSessionPlan, dueCount, estimateSessionMinutes } from '../srs/session'
import type { Profile, ReviewRecord, StudyMeta, VocabularyWord } from '../vocab/types'
import { toPlanReview } from './reviews'

export function makePlan(input: {
  words: VocabularyWord[]
  reviews: ReviewRecord[]
  profile: Profile
  meta: StudyMeta
  now?: Date
  extraNew?: number
}) {
  const now = input.now ?? new Date()
  const reviews = input.reviews.map(toPlanReview)
  const plan = buildSessionPlan({
    words: input.words.map((word) => ({ id: word.id, headword: word.headword, difficulty: word.difficulty })),
    reviews,
    now,
    minutes: input.profile.dailyMinutes,
    pace: input.profile.pace,
    newWordsAlreadyToday: newWordsOnDate(input.meta, localISODate(now)),
    extraNew: input.extraNew ?? 0,
  })
  return {
    plan,
    due: dueCount(reviews, now),
    minutes: estimateSessionMinutes(plan),
    sessionReviews: plan.filter((step) => step.phase === 'warmup' || step.phase === 'review').length,
    sessionNew: plan.filter((step) => step.phase === 'new').length,
  }
}
