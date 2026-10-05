import type { AnswerResult, VocabularyWord } from '../vocab/types'

const STOP = new Set(
  'a an the of to and or in on for with by from as that this is be was were are very more most not it its into over after before than then so such only also can may you your'.split(
    ' ',
  ),
)

export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' -]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function levenshtein(left: string, right: string): number {
  const rows = left.length + 1
  const cols = right.length + 1
  const grid = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))
  for (let row = 0; row < rows; row += 1) grid[row][0] = row
  for (let col = 0; col < cols; col += 1) grid[0][col] = col
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1
      grid[row][col] = Math.min(grid[row - 1][col] + 1, grid[row][col - 1] + 1, grid[row - 1][col - 1] + cost)
    }
  }
  return grid[left.length][right.length]
}

function typoLimit(length: number): number {
  if (length <= 4) return 0
  if (length <= 8) return 1
  return 2
}

export function gradeTyped(
  input: string,
  accepted: string[],
  related: string[] = [],
): { result: AnswerResult; expected: string } {
  const expected = accepted[0] || related[0] || ''
  const given = normalizeAnswer(input)
  if (!given) return { result: 'incorrect', expected }
  const targets = accepted.map(normalizeAnswer).filter(Boolean)
  if (targets.includes(given)) return { result: 'correct', expected }
  const relatedTargets = related.map(normalizeAnswer).filter(Boolean)
  if (relatedTargets.includes(given)) return { result: 'partial', expected }
  for (const target of targets) {
    const distance = levenshtein(given, target)
    if (target.length >= 4 && distance <= typoLimit(target.length)) return { result: 'partial', expected }
  }
  return { result: 'incorrect', expected }
}

export function contentWords(text: string): string[] {
  return normalizeAnswer(text)
    .split(' ')
    .filter((word) => word.length > 2 && !STOP.has(word))
}

export function gradeMeaning(answer: string, word: VocabularyWord): { result: AnswerResult; uncertain: boolean } {
  const given = contentWords(answer)
  if (!given.length) return { result: 'incorrect', uncertain: false }
  const targetList = [
    ...contentWords(word.primary_definition),
    ...word.secondary_definitions.flatMap(contentWords),
    ...word.synonyms.flatMap(contentWords),
    ...word.near_synonyms.flatMap(contentWords),
    ...contentWords(word.simple_definition || ''),
  ]
  const target = new Set(targetList)
  if (!target.size) return { result: 'incorrect', uncertain: true }
  const hits = given.filter((token) =>
    [...target].some((item) => item === token || (item.length > 4 && (item.startsWith(token) || token.startsWith(item)))),
  )
  if (hits.length >= 2 || (hits.length >= 1 && hits.length / Math.min(given.length, target.size) >= 0.5)) {
    return { result: 'correct', uncertain: false }
  }
  if (hits.length === 1) return { result: 'partial', uncertain: false }
  if (given.length >= 3) return { result: 'incorrect', uncertain: true }
  return { result: 'incorrect', uncertain: false }
}

export function productionHasWord(answer: string, word: VocabularyWord): boolean {
  const forms = [word.headword, ...word.alternate_forms, ...word.word_family].map(normalizeAnswer).filter(Boolean)
  const given = normalizeAnswer(answer)
  return forms.some((form) => new RegExp(`(?:^| )${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: |$)`).test(` ${given} `))
}

export function gradeChoice(choiceCorrect: boolean | undefined): AnswerResult {
  return choiceCorrect ? 'correct' : 'incorrect'
}
