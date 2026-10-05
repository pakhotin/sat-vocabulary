import type { ReviewStatus, UsageChoice, VocabularyWord } from './types'

export const CSV_COLUMNS = [
  'id',
  'headword',
  'alternate_forms',
  'part_of_speech',
  'pronunciation',
  'audio_url',
  'primary_definition',
  'secondary_definitions',
  'example_sentences',
  'cloze_sentences',
  'synonyms',
  'near_synonyms',
  'antonyms',
  'collocations',
  'word_family',
  'etymology',
  'register',
  'usage_notes',
  'common_confusions',
  'mnemonic',
  'tags',
  'difficulty',
  'source_or_editor',
  'definition_status',
  'review_status',
] as const

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function joinList(values: string[]): string {
  return values.join(' | ')
}

function splitList(value: string): string[] {
  return value
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
}

function statusOf(value: string): ReviewStatus {
  return value === 'approved' ? 'approved' : 'draft'
}

export function toCsv(words: VocabularyWord[]): string {
  const lines = [CSV_COLUMNS.join(',')]
  for (const word of words) {
    const cells = CSV_COLUMNS.map((column) => {
      if (column === 'example_sentences') return csvEscape(joinList(word.example_sentences.map((item) => item.text)))
      if (column === 'cloze_sentences') return csvEscape(joinList(word.cloze_sentences.map((item) => item.text)))
      const value = word[column]
      if (Array.isArray(value)) return csvEscape(joinList(value))
      return csvEscape(value == null ? '' : String(value))
    })
    lines.push(cells.join(','))
  }
  return `${lines.join('\n')}\n`
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const filled = rows.filter((cells) => cells.some((value) => value.trim()))
  if (!filled.length) return []
  const [header, ...body] = filled
  return body.map((cells) => {
    const record: Record<string, string> = {}
    header.forEach((key, index) => {
      record[key.trim()] = cells[index] ?? ''
    })
    return record
  })
}

function clozeFromExample(sentence: string, headword: string): { text: string; answer: string } | null {
  const pattern = new RegExp(`\\b${headword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  const match = sentence.match(pattern)
  if (!match) return null
  return { text: sentence.replace(pattern, '_____'), answer: match[0] }
}

export function wordFromRecord(record: Record<string, string>, index: number): VocabularyWord {
  const reviewStatus = statusOf(record.review_status || 'draft')
  const definitionStatus = statusOf(record.definition_status || 'approved')
  const examples = splitList(record.example_sentences || '').map((text) => ({ text, status: reviewStatus }))
  const clozeTexts = splitList(record.cloze_sentences || '')
  const clozes = clozeTexts.length
    ? clozeTexts.map((text) => ({
        text,
        answer: record.headword || '',
        status: reviewStatus,
      }))
    : examples
        .map((example) => clozeFromExample(example.text, record.headword || ''))
        .filter((item): item is { text: string; answer: string } => Boolean(item))
        .map((item) => ({ ...item, status: reviewStatus }))
  let usage: UsageChoice[] = []
  if (record.usage_choices) {
    try {
      const parsed = JSON.parse(record.usage_choices) as UsageChoice[]
      if (Array.isArray(parsed)) usage = parsed
    } catch {
      usage = []
    }
  }
  return {
    id: (record.id || `word-${index + 1}`).trim(),
    headword: (record.headword || '').trim(),
    alternate_forms: splitList(record.alternate_forms || ''),
    part_of_speech: (record.part_of_speech || '').trim(),
    pronunciation: record.pronunciation || '',
    audio_url: record.audio_url || '',
    primary_definition: (record.primary_definition || '').trim(),
    secondary_definitions: splitList(record.secondary_definitions || ''),
    definition_status: definitionStatus,
    simple_definition: record.simple_definition || '',
    example_sentences: examples,
    cloze_sentences: clozes,
    synonyms: splitList(record.synonyms || ''),
    near_synonyms: splitList(record.near_synonyms || ''),
    antonyms: splitList(record.antonyms || ''),
    collocations: splitList(record.collocations || ''),
    word_family: splitList(record.word_family || ''),
    etymology: record.etymology || '',
    register: record.register || '',
    usage_notes: record.usage_notes || '',
    common_confusions: splitList(record.common_confusions || ''),
    mnemonic: record.mnemonic || '',
    tags: splitList(record.tags || ''),
    difficulty: Number(record.difficulty) || 2,
    source_or_editor: record.source_or_editor || 'imported',
    review_status: reviewStatus,
    question_id: record.question_id || '',
    answer_role: record.answer_role || '',
    compare_with: splitList(record.compare_with || ''),
    usage_choices: usage,
  }
}

export function parseVocabularyText(text: string): VocabularyWord[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as VocabularyWord[] | VocabularyWord
    const list = Array.isArray(parsed) ? parsed : [parsed]
    return list.map((word, index) => wordFromRecord({ ...flattenWord(word) }, index))
  }
  return parseCsv(trimmed).map(wordFromRecord)
}

function flattenWord(word: VocabularyWord): Record<string, string> {
  return {
    ...Object.fromEntries(
      Object.entries(word).map(([key, value]) => {
        if (key === 'example_sentences' && Array.isArray(value)) {
          return [key, (value as VocabularyWord['example_sentences']).map((item) => item.text).join(' | ')]
        }
        if (key === 'cloze_sentences' && Array.isArray(value)) {
          return [key, (value as VocabularyWord['cloze_sentences']).map((item) => item.text).join(' | ')]
        }
        if (key === 'usage_choices') return [key, JSON.stringify(value)]
        if (Array.isArray(value)) return [key, value.join(' | ')]
        return [key, value == null ? '' : String(value)]
      }),
    ),
  }
}
