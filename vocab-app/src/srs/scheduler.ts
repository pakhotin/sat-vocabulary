import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs'

export type { Grade }

const withFuzz = fsrs(generatorParameters({ enable_fuzz: true }))
const withoutFuzz = fsrs(generatorParameters({ enable_fuzz: false }))

export { Rating, State }
export type { Card }

export function freshCard(now: Date): Card {
  return createEmptyCard(now)
}

export function applyRating(card: Card, rating: Grade, now: Date, fuzz = true): Card {
  const engine = fuzz ? withFuzz : withoutFuzz
  return engine.next(card, now, rating).card
}

export function cardToJson(card: Card): string {
  return JSON.stringify(card)
}

export function cardFromJson(json: string): Card {
  const raw = JSON.parse(json) as Card
  return {
    ...raw,
    due: new Date(raw.due),
    last_review: raw.last_review ? new Date(raw.last_review) : undefined,
  }
}

export function formatInterval(from: Date, due: Date): string {
  const minutes = Math.max(0, Math.round((due.getTime() - from.getTime()) / 60000))
  if (minutes <= 1) return 'in about a minute'
  if (minutes < 60) return `in about ${minutes} minutes`
  const hours = Math.round(minutes / 60)
  if (hours < 20) return hours === 1 ? 'in about an hour' : `in about ${hours} hours`
  const days = Math.round(hours / 24)
  if (days <= 1) return 'tomorrow'
  if (days < 14) return `in ${days} days`
  const weeks = Math.round(days / 7)
  if (weeks < 8) return weeks === 1 ? 'in about a week' : `in ${weeks} weeks`
  const months = Math.max(1, Math.round(days / 30))
  return months === 1 ? 'in about a month' : `in about ${months} months`
}
