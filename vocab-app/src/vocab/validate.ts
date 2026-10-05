import type { VocabularyWord } from './types'

export interface ValidationIssue {
  level: 'error' | 'warning'
  wordId?: string
  message: string
}

const VAGUE = /^(something|stuff|a thing|things|various|good|bad|nice)$/i
const POS_KINDS = ['noun', 'verb', 'adjective', 'adverb']

export function isVagueDefinition(definition: string): boolean {
  const text = definition.trim()
  if (text.length < 3) return true
  return VAGUE.test(text)
}

export function contradictoryPartOfSpeech(partOfSpeech: string, tags: string[]): boolean {
  if (tags.includes('multi-pos')) return false
  const found = POS_KINDS.filter((kind) => new RegExp(`\\b${kind}\\b`, 'i').test(partOfSpeech))
  return found.length > 1
}

export function validateVocabulary(
  words: VocabularyWord[],
  options?: { requireExamples?: boolean },
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const heads = new Map<string, string>()
  const ids = new Map<string, string>()
  for (const word of words) {
    const headKey = word.headword.trim().toLowerCase()
    if (!word.id.trim()) {
      issues.push({ level: 'error', message: 'A word is missing an id.' })
    } else if (ids.has(word.id)) {
      issues.push({ level: 'error', wordId: word.id, message: `Duplicate id: ${word.id}` })
    } else {
      ids.set(word.id, word.headword)
    }
    if (!headKey) {
      issues.push({ level: 'error', wordId: word.id, message: 'A word is missing a headword.' })
    } else if (heads.has(headKey)) {
      issues.push({ level: 'error', wordId: word.id, message: `Duplicate headword: ${word.headword}` })
    } else {
      heads.set(headKey, word.id)
    }
    if (!word.primary_definition.trim()) {
      issues.push({ level: 'error', wordId: word.id, message: `Missing definition: ${word.headword || word.id}` })
    } else if (isVagueDefinition(word.primary_definition)) {
      issues.push({ level: 'warning', wordId: word.id, message: `Vague definition: ${word.headword}` })
    }
    if (!word.part_of_speech.trim()) {
      issues.push({ level: 'error', wordId: word.id, message: `Missing part of speech: ${word.headword}` })
    } else if (contradictoryPartOfSpeech(word.part_of_speech, word.tags)) {
      issues.push({
        level: 'error',
        wordId: word.id,
        message: `Contradictory part of speech: ${word.headword} (${word.part_of_speech})`,
      })
    }
    if (!word.example_sentences.length || word.example_sentences.every((item) => !item.text.trim())) {
      const message = `Missing example: ${word.headword || word.id}`
      issues.push({ level: options?.requireExamples ? 'error' : 'warning', wordId: word.id, message })
    }
  }
  return issues
}

export function validationErrors(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue) => issue.level === 'error')
}
