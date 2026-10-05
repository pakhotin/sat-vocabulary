import type { MasteryLevel, Pace } from '../vocab/types'
import { daysBetween } from './dates'
import { Rating, State } from './scheduler'

export interface MasteryInput {
  reps: number
  lapses: number
  scheduledDays: number
  state: number
  lastRating: number | null
}

export interface StreakState {
  streak: number
  lastStudyDate: string | null
  freezeAvailable: boolean
  studyDaysSinceFreeze: number
}

export function newWordsOnDate(meta: { newWordsDate: string | null; newWordsToday: number }, today: string): number {
  return meta.newWordsDate === today ? meta.newWordsToday : 0
}

export function dailyNewCap(minutes: number, pace: Pace): number {
  const base = minutes <= 5 ? 3 : minutes <= 10 ? 5 : minutes <= 15 ? 8 : 12
  const adjusted = pace === 'gentle' ? base - 2 : pace === 'intensive' ? base + 3 : base
  return Math.max(2, adjusted)
}

export function newCapIsHigh(cap: number): boolean {
  return cap >= 12
}

export function masteryOf(input: MasteryInput | null): MasteryLevel {
  if (!input || input.reps <= 0) return 'new'
  const needsAttention = input.lastRating === Rating.Again || (input.lapses >= 2 && input.scheduledDays < 7)
  if (needsAttention) return 'needs-attention'
  if (input.state === State.Review && input.scheduledDays >= 21 && input.reps >= 3) return 'mastered'
  if (input.state === State.Review) return 'reviewing'
  return 'learning'
}

export function progressCounts(records: MasteryInput[]): { introduced: number; mastered: number; attention: number } {
  let introduced = 0
  let mastered = 0
  let attention = 0
  for (const record of records) {
    if (record.reps > 0) introduced += 1
    const level = masteryOf(record)
    if (level === 'mastered') mastered += 1
    if (level === 'needs-attention') attention += 1
  }
  return { introduced, mastered, attention }
}

export function xpFor(result: 'correct' | 'partial' | 'incorrect', typed: boolean): number {
  if (result === 'incorrect') return 0
  if (result === 'partial') return 6
  return typed ? 12 : 5
}

export function isTypedQuestion(type: string): boolean {
  return type === 'definition-to-word' || type === 'cloze' || type === 'word-to-meaning' || type === 'sentence-production'
}

export function applyStudyDay(
  state: StreakState,
  today: string,
  protection: boolean,
): StreakState & { usedFreeze: boolean } {
  if (state.lastStudyDate === today) {
    return { ...state, streak: Math.max(state.streak, 1), usedFreeze: false }
  }
  if (!state.lastStudyDate) {
    return {
      streak: 1,
      lastStudyDate: today,
      freezeAvailable: state.freezeAvailable,
      studyDaysSinceFreeze: state.freezeAvailable ? state.studyDaysSinceFreeze : state.studyDaysSinceFreeze + 1,
      usedFreeze: false,
    }
  }
  const gap = daysBetween(state.lastStudyDate, today)
  if (gap === 1) {
    const studyDaysSinceFreeze = state.freezeAvailable ? state.studyDaysSinceFreeze : state.studyDaysSinceFreeze + 1
    const freezeAvailable = state.freezeAvailable || studyDaysSinceFreeze >= 3
    return {
      streak: state.streak + 1,
      lastStudyDate: today,
      freezeAvailable,
      studyDaysSinceFreeze: freezeAvailable && !state.freezeAvailable ? 0 : studyDaysSinceFreeze,
      usedFreeze: false,
    }
  }
  if (protection && state.freezeAvailable && gap === 2) {
    return {
      streak: state.streak + 1,
      lastStudyDate: today,
      freezeAvailable: false,
      studyDaysSinceFreeze: 0,
      usedFreeze: true,
    }
  }
  return {
    streak: 1,
    lastStudyDate: today,
    freezeAvailable: state.freezeAvailable,
    studyDaysSinceFreeze: state.studyDaysSinceFreeze,
    usedFreeze: false,
  }
}

export function earnedBadges(input: {
  mastered: number
  streak: number
  typedCorrect: number
  sessions: number
  usedFreeze: boolean
}): string[] {
  const badges: string[] = []
  if (input.sessions >= 1) badges.push('First session')
  if (input.streak >= 7) badges.push('Seven-day streak')
  for (const milestone of [25, 50, 100, 250, 500, 1000]) {
    if (input.mastered >= milestone) badges.push(`${milestone} words mastered`)
  }
  if (input.typedCorrect >= 50) badges.push('Fifty typed recalls')
  if (input.usedFreeze) badges.push('Streak protected')
  return badges
}

export const MILESTONES = [25, 50, 100, 250, 500, 1000]
