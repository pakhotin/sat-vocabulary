import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cardFromJson, cardToJson, applyRating, formatInterval, freshCard, Rating, type Card, type Grade } from '../srs/scheduler'
import { localISODate } from '../srs/dates'
import { applyStudyDay, newWordsOnDate } from '../srs/progress'
import { db } from '../storage/db'
import { bundledWords } from '../vocab/bundled'
import {
  defaultMeta,
  defaultProfile,
  type AnswerResult,
  type Profile,
  type QuestionType,
  type ReviewRecord,
  type StudyMeta,
  type VocabularyWord,
} from '../vocab/types'

interface Bag {
  profile: Profile | null
  meta: StudyMeta
  reviews: ReviewRecord[]
  words: VocabularyWord[]
}

interface StudyValue {
  ready: boolean
  error: string
  words: VocabularyWord[]
  wordById: Map<string, VocabularyWord>
  profile: Profile | null
  reviews: ReviewRecord[]
  meta: StudyMeta
  usingOverride: boolean
  saveProfile: (profile: Profile) => Promise<void>
  markKnown: (wordIds: string[]) => Promise<void>
  addXp: (amount: number, typedCorrect: boolean) => Promise<void>
  rateWord: (args: {
    wordId: string
    rating: Grade
    result: AnswerResult
    questionType: QuestionType | string
    countsAsNew: boolean
  }) => Promise<string>
  toggleFavorite: (wordId: string) => Promise<void>
  finishSession: (sessionId: string) => Promise<void>
  replaceWords: (words: VocabularyWord[]) => Promise<void>
  updateWord: (word: VocabularyWord) => Promise<void>
  resetWords: () => Promise<void>
  exportProgress: (anonymized: boolean) => string
  importProgress: (text: string) => Promise<void>
  resetProgress: () => Promise<void>
}

const StudyContext = createContext<StudyValue | null>(null)

export function StudyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [words, setWords] = useState<VocabularyWord[]>(bundledWords)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [reviews, setReviews] = useState<ReviewRecord[]>([])
  const [meta, setMeta] = useState<StudyMeta>(defaultMeta())
  const [usingOverride, setUsingOverride] = useState(false)
  const bag = useRef<Bag>({ profile: null, meta: defaultMeta(), reviews: [], words: bundledWords })
  const queue = useRef(Promise.resolve())

  useEffect(() => {
    let cancel = false
    Promise.all([db.profile.get('local'), db.reviews.toArray(), db.meta.get('local'), db.vocab.get('local')])
      .then(async ([profileRow, reviewRows, metaRow, vocabRow]) => {
        if (cancel) return
        const nextMeta = metaRow ?? defaultMeta()
        if (!metaRow) await db.meta.put(nextMeta)
        const nextWords = vocabRow?.words?.length ? vocabRow.words : bundledWords
        bag.current = { profile: profileRow ?? null, meta: nextMeta, reviews: reviewRows, words: nextWords }
        setProfile(profileRow ?? null)
        setReviews(reviewRows)
        setMeta(nextMeta)
        setWords(nextWords)
        setUsingOverride(Boolean(vocabRow?.words?.length))
        setReady(true)
      })
      .catch((caught: unknown) => {
        if (cancel) return
        setError(caught instanceof Error ? caught.message : 'Could not open saved progress.')
        setReady(true)
      })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    const scale = profile?.fontScale ?? 1
    document.documentElement.style.fontSize = `${16 * scale}px`
    document.body.classList.toggle('reduced-motion', Boolean(profile?.reducedMotion))
  }, [profile])

  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = queue.current.then(job)
    queue.current = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  function commitMeta(next: StudyMeta) {
    bag.current = { ...bag.current, meta: next }
    setMeta(next)
    return db.meta.put(next)
  }

  function commitReviews(next: ReviewRecord[]) {
    bag.current = { ...bag.current, reviews: next }
    setReviews(next)
  }

  const value = useMemo<StudyValue>(() => {
    const wordById = new Map(words.map((word) => [word.id, word]))
    return {
      ready,
      error,
      words,
      wordById,
      profile,
      reviews,
      meta,
      usingOverride,
      saveProfile: (next) =>
        enqueue(async () => {
          const stored = { ...next, id: 'local' as const }
          bag.current = { ...bag.current, profile: stored }
          setProfile(stored)
          await db.profile.put(stored)
        }),
      markKnown: (wordIds) =>
        enqueue(async () => {
          const now = new Date()
          const existing = new Set(bag.current.reviews.map((review) => review.wordId))
          const added: ReviewRecord[] = []
          for (const wordId of wordIds) {
            if (existing.has(wordId)) continue
            const card = applyRating(freshCard(now), Rating.Easy, now)
            added.push(
              recordFrom(wordId, card, Rating.Easy, 1, [
                { at: now.toISOString(), rating: Rating.Easy, questionType: 'diagnostic', result: 'correct' },
              ]),
            )
          }
          if (!added.length) return
          const next = bag.current.reviews.concat(added)
          commitReviews(next)
          await db.reviews.bulkPut(added)
        }),
      addXp: (amount, typedCorrect) =>
        enqueue(async () => {
          const current = bag.current.meta
          await commitMeta({
            ...current,
            xp: current.xp + amount,
            typedCorrect: current.typedCorrect + (typedCorrect ? 1 : 0),
          })
        }),
      rateWord: ({ wordId, rating, result, questionType, countsAsNew }) =>
        enqueue(async () => {
          const now = new Date()
          const current = bag.current.reviews.find((review) => review.wordId === wordId)
          const card = current ? cardFromJson(current.cardJson) : freshCard(now)
          const nextCard = applyRating(card, rating, now)
          const success = rating !== Rating.Again
          const history = [
            ...(current?.history ?? []),
            { at: now.toISOString(), rating, questionType, result },
          ].slice(-30)
          const nextRecord = recordFrom(wordId, nextCard, rating, (current?.successCount ?? 0) + (success ? 1 : 0), history)
          const nextReviews = bag.current.reviews.filter((review) => review.wordId !== wordId).concat(nextRecord)
          commitReviews(nextReviews)
          await db.reviews.put(nextRecord)
          const today = localISODate(now)
          const currentMeta = bag.current.meta
          const already = newWordsOnDate(currentMeta, today)
          if (countsAsNew && !current) {
            await commitMeta({
              ...currentMeta,
              newWordsDate: today,
              newWordsToday: already + 1,
            })
          }
          return formatInterval(now, nextCard.due)
        }),
      toggleFavorite: (wordId) =>
        enqueue(async () => {
          const current = bag.current.meta
          const favorites = current.favorites.includes(wordId)
            ? current.favorites.filter((id) => id !== wordId)
            : current.favorites.concat(wordId)
          await commitMeta({ ...current, favorites })
        }),
      finishSession: (sessionId) =>
        enqueue(async () => {
          const current = bag.current.meta
          if (current.lastFinishedSessionId === sessionId) return
          const today = localISODate(new Date())
          const next = applyStudyDay(current, today, bag.current.profile?.streakProtection !== false)
          await commitMeta({
            ...current,
            streak: next.streak,
            lastStudyDate: next.lastStudyDate,
            freezeAvailable: next.freezeAvailable,
            studyDaysSinceFreeze: next.studyDaysSinceFreeze,
            freezeEverUsed: current.freezeEverUsed || next.usedFreeze,
            sessionsCompleted: current.sessionsCompleted + 1,
            lastFinishedSessionId: sessionId,
          })
        }),
      replaceWords: (nextWords) =>
        enqueue(async () => {
          bag.current = { ...bag.current, words: nextWords }
          setWords(nextWords)
          setUsingOverride(true)
          await db.vocab.put({ id: 'local', words: nextWords })
        }),
      updateWord: (word) =>
        enqueue(async () => {
          const nextWords = bag.current.words.map((item) => (item.id === word.id ? word : item))
          bag.current = { ...bag.current, words: nextWords }
          setWords(nextWords)
          setUsingOverride(true)
          await db.vocab.put({ id: 'local', words: nextWords })
        }),
      resetWords: () =>
        enqueue(async () => {
          bag.current = { ...bag.current, words: bundledWords }
          setWords(bundledWords)
          setUsingOverride(false)
          await db.vocab.delete('local')
        }),
      exportProgress: (anonymized) => {
        const currentProfile = bag.current.profile
        return JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            profile: currentProfile
              ? { ...currentProfile, educationLevel: anonymized ? '' : currentProfile.educationLevel }
              : null,
            meta: bag.current.meta,
            reviews: bag.current.reviews,
          },
          null,
          2,
        )
      },
      importProgress: (text) =>
        enqueue(async () => {
          const parsed = JSON.parse(text) as {
            version?: number
            profile?: Profile | null
            meta?: StudyMeta
            reviews?: ReviewRecord[]
          }
          if (parsed.version !== 1 || !parsed.meta || !Array.isArray(parsed.reviews)) {
            throw new Error('This file is not a vocabulary progress backup.')
          }
          const nextProfile = parsed.profile ? { ...defaultProfile(), ...parsed.profile, id: 'local' as const } : bag.current.profile
          const nextMeta = { ...defaultMeta(), ...parsed.meta, id: 'local' as const }
          if (nextProfile) {
            bag.current = { ...bag.current, profile: nextProfile }
            setProfile(nextProfile)
            await db.profile.put(nextProfile)
          }
          bag.current = { ...bag.current, meta: nextMeta, reviews: parsed.reviews }
          setMeta(nextMeta)
          setReviews(parsed.reviews)
          await db.meta.put(nextMeta)
          await db.reviews.clear()
          await db.reviews.bulkPut(parsed.reviews)
        }),
      resetProgress: () =>
        enqueue(async () => {
          const nextMeta = { ...defaultMeta(), favorites: bag.current.meta.favorites }
          bag.current = { ...bag.current, meta: nextMeta, reviews: [] }
          setMeta(nextMeta)
          setReviews([])
          await db.reviews.clear()
          await db.meta.put(nextMeta)
        }),
    }
    // The enqueue helpers close over refs, so the provider value can refresh when state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, error, words, profile, reviews, meta, usingOverride])

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}

function recordFrom(
  wordId: string,
  card: Card,
  rating: number,
  successCount: number,
  history: ReviewRecord['history'],
): ReviewRecord {
  return {
    wordId,
    due: card.due.toISOString(),
    cardJson: cardToJson(card),
    lastRating: rating,
    successCount,
    history,
  }
}

export function useStudy(): StudyValue {
  const value = useContext(StudyContext)
  if (!value) throw new Error('Study tools are only available inside the app.')
  return value
}
