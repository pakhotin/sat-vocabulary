import { describe, expect, it } from 'vitest'
import { gradeMeaning, gradeTyped, productionHasWord } from '../src/questions/grade'
import { applyRating, freshCard, Rating, State } from '../src/srs/scheduler'
import { applyStudyDay, masteryOf, progressCounts, xpFor } from '../src/srs/progress'
import { buildSessionPlan } from '../src/srs/session'
import { bundledWords } from '../src/vocab/bundled'
import { parseVocabularyText, toCsv } from '../src/vocab/csv'
import { validateVocabulary } from '../src/vocab/validate'
import type { VocabularyWord } from '../src/vocab/types'

function word(partial: Partial<VocabularyWord> & Pick<VocabularyWord, 'id' | 'headword'>): VocabularyWord {
  return {
    alternate_forms: [],
    part_of_speech: 'noun',
    pronunciation: '',
    audio_url: '',
    primary_definition: 'a clear meaning',
    secondary_definitions: [],
    definition_status: 'approved',
    simple_definition: '',
    example_sentences: [{ text: `This sentence uses ${partial.headword} clearly.`, status: 'approved' }],
    cloze_sentences: [],
    synonyms: [],
    near_synonyms: [],
    antonyms: [],
    collocations: [],
    word_family: [],
    etymology: '',
    register: '',
    usage_notes: '',
    common_confusions: [],
    mnemonic: '',
    tags: [],
    difficulty: 2,
    source_or_editor: 'test',
    review_status: 'approved',
    question_id: '',
    answer_role: '',
    compare_with: [],
    usage_choices: [],
    ...partial,
  }
}

describe('spaced repetition', () => {
  it('schedules Again sooner than Good', () => {
    const now = new Date('2026-04-04T15:00:00Z')
    const again = applyRating(freshCard(now), Rating.Again, now, false)
    const good = applyRating(freshCard(now), Rating.Good, now, false)
    expect(again.due.getTime()).toBeLessThan(good.due.getTime())
    expect(again.lapses).toBeGreaterThanOrEqual(0)
    expect(good.reps).toBeGreaterThan(0)
  })
})

describe('answer checking', () => {
  const abide = word({
    id: 'abide',
    headword: 'abide',
    part_of_speech: 'verb',
    primary_definition: 'live, stay (old use)',
    secondary_definitions: ['abide by: obey, accept'],
    simple_definition: 'stay, or obey when the phrase is abide by',
    synonyms: ['remain', 'stay'],
    alternate_forms: ['abode'],
  })

  it('accepts capitalization and small typos, and rejects a different word', () => {
    expect(gradeTyped(' Abide ', ['abide']).result).toBe('correct')
    expect(gradeTyped('abidee', ['abide']).result).toBe('partial')
    expect(gradeTyped('we', ['ye']).result).toBe('incorrect')
    expect(gradeTyped('abode', ['abide'], ['abode']).result).toBe('partial')
  })

  it('grades a short meaning and a sentence that uses the word', () => {
    expect(gradeMeaning('to stay or remain', abide).result).toBe('correct')
    expect(gradeMeaning('banana', abide).result).toBe('incorrect')
    expect(productionHasWord('The traveler will abide there.', abide)).toBe(true)
    expect(productionHasWord('The traveler will leave.', abide)).toBe(false)
    expect(xpFor('correct', true)).toBeGreaterThan(xpFor('correct', false))
    expect(xpFor('incorrect', true)).toBe(0)
  })
})

describe('vocabulary validation', () => {
  it('flags duplicate headwords and contradictory parts of speech', () => {
    const first = word({ id: 'a', headword: 'alpha' })
    const second = word({ id: 'b', headword: 'Alpha' })
    const both = word({ id: 'c', headword: 'both', part_of_speech: 'noun verb' })
    const issues = validateVocabulary([first, second, both])
    expect(issues.some((issue) => issue.message.includes('Duplicate headword'))).toBe(true)
    expect(issues.some((issue) => issue.message.includes('Contradictory part of speech'))).toBe(true)
  })

  it('ships the source list without validation errors', () => {
    const issues = validateVocabulary(bundledWords, { requireExamples: true })
    expect(issues.filter((issue) => issue.level === 'error')).toEqual([])
    expect(bundledWords.length).toBeGreaterThan(800)
    const approved = bundledWords.filter((item) => item.review_status === 'approved').map((item) => item.headword)
    expect(approved).toEqual(expect.arrayContaining(['abide', 'abound', 'abrasive', 'accrete', 'accrue']))
    expect(approved.length).toBeGreaterThanOrEqual(25)
    for (const item of bundledWords) {
      expect(item.primary_definition.length).toBeGreaterThan(0)
      expect(item.example_sentences[0]?.text.length).toBeGreaterThan(0)
    }
  })

  it('round-trips a word through CSV', () => {
    const original = word({ id: 'alpha', headword: 'alpha', primary_definition: 'a sample, with a comma' })
    const parsed = parseVocabularyText(toCsv([original]))
    expect(parsed[0]?.headword).toBe('alpha')
    expect(parsed[0]?.primary_definition).toBe('a sample, with a comma')
    expect(parsed[0]?.example_sentences[0]?.text).toContain('alpha')
  })
})

describe('progress', () => {
  it('counts introduced, mastered, and words that need attention', () => {
    const counts = progressCounts([
      { reps: 0, lapses: 0, scheduledDays: 0, state: State.New, lastRating: null },
      { reps: 4, lapses: 0, scheduledDays: 21, state: State.Review, lastRating: Rating.Good },
      { reps: 3, lapses: 2, scheduledDays: 1, state: State.Relearning, lastRating: Rating.Again },
    ])
    expect(counts).toEqual({ introduced: 2, mastered: 1, attention: 1 })
    expect(masteryOf({ reps: 4, lapses: 0, scheduledDays: 21, state: State.Review, lastRating: Rating.Good })).toBe('mastered')
  })

  it('keeps a streak through one missed day when protection is available', () => {
    const first = applyStudyDay(
      { streak: 0, lastStudyDate: null, freezeAvailable: true, studyDaysSinceFreeze: 0 },
      '2026-04-01',
      true,
    )
    const next = applyStudyDay(first, '2026-04-02', true)
    const protectedDay = applyStudyDay(next, '2026-04-04', true)
    expect(first.streak).toBe(1)
    expect(next.streak).toBe(2)
    expect(protectedDay.streak).toBe(3)
    expect(protectedDay.usedFreeze).toBe(true)
    expect(protectedDay.freezeAvailable).toBe(false)
    const reset = applyStudyDay(protectedDay, '2026-04-07', true)
    expect(reset.streak).toBe(1)
  })
})

describe('session order', () => {
  it('places due reviews before new words', () => {
    const words = Array.from({ length: 12 }, (_, index) => ({
      id: `w${index}`,
      headword: `word${String.fromCharCode(97 + (index % 26))}${index}`,
      difficulty: 2,
    }))
    const reviews = [
      {
        wordId: 'w0',
        due: '2020-01-01T00:00:00.000Z',
        stability: 1,
        reps: 2,
        lapses: 0,
        lastRating: Rating.Good,
        scheduledDays: 1,
      },
      {
        wordId: 'w1',
        due: '2020-01-02T00:00:00.000Z',
        stability: 8,
        reps: 4,
        lapses: 0,
        lastRating: Rating.Good,
        scheduledDays: 8,
      },
    ]
    const plan = buildSessionPlan({
      words,
      reviews,
      now: new Date('2026-04-04T12:00:00Z'),
      minutes: 15,
      pace: 'standard',
      newWordsAlreadyToday: 0,
    })
    const firstNew = plan.findIndex((step) => step.phase === 'new')
    const lastDue = Math.max(
      ...plan.map((step, index) => (step.phase === 'review' || step.phase === 'warmup' ? index : -1)),
    )
    expect(firstNew).toBeGreaterThan(lastDue)
    expect(plan.filter((step) => step.phase === 'review' || step.phase === 'warmup').map((step) => step.wordId)).toEqual(
      expect.arrayContaining(['w0', 'w1']),
    )
  })

  it('does not add new words when due reviews fill the time', () => {
    const reviews = Array.from({ length: 30 }, (_, index) => ({
      wordId: `w${index}`,
      due: '2020-01-01T00:00:00.000Z',
      stability: 2,
      reps: 2,
      lapses: 0,
      lastRating: Rating.Good,
      scheduledDays: 1,
    }))
    const plan = buildSessionPlan({
      words: reviews.map((review, index) => ({ id: review.wordId, headword: `word${index}`, difficulty: 2 })),
      reviews,
      now: new Date('2026-04-04T12:00:00Z'),
      minutes: 5,
      pace: 'standard',
      newWordsAlreadyToday: 0,
    })
    expect(plan.some((step) => step.phase === 'new')).toBe(false)
    expect(plan.some((step) => step.phase === 'review' || step.phase === 'warmup')).toBe(true)
  })
})
