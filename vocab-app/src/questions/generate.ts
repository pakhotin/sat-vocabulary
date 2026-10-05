import type { Profile, QuestionType, VocabularyWord } from '../vocab/types'

export interface Choice {
  id: string
  text: string
  correct: boolean
  note?: string
}

export interface Question {
  id: string
  wordId: string
  type: QuestionType
  prompt: string
  detail?: string
  choices?: Choice[]
  accepted: string[]
  related: string[]
  explanation: string
  example: string
  confusion?: string
  speakText?: string
}

function randomOf(random: () => number) {
  return random
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const current = copy[index]
    copy[index] = copy[swap]
    copy[swap] = current
  }
  return copy
}

function others(word: VocabularyWord, words: VocabularyWord[], count: number, random: () => number): VocabularyWord[] {
  return shuffle(
    words.filter((item) => item.id !== word.id),
    random,
  ).slice(0, count)
}

function exampleOf(word: VocabularyWord): string {
  return word.example_sentences[0]?.text || ''
}

function explanationOf(word: VocabularyWord): string {
  const extra = word.secondary_definitions[0] ? ` Also: ${word.secondary_definitions[0]}.` : ''
  return `${word.headword} (${word.part_of_speech}) means ${word.primary_definition}.${extra}`
}

export function familyForms(word: VocabularyWord): string[] {
  return [...new Set([...word.alternate_forms, ...word.word_family])].filter(
    (form) => form.toLowerCase() !== word.headword.toLowerCase(),
  )
}

export function chooseQuestionType(
  word: VocabularyWord,
  profile: Profile,
  phase: 'warmup' | 'review' | 'retry',
  random: () => number = Math.random,
): QuestionType {
  if (phase === 'warmup') {
    return word.cloze_sentences.length && random() < 0.4 ? 'cloze' : 'definition-to-word'
  }
  if (phase === 'retry') return random() < 0.5 ? 'word-to-meaning-choice' : 'definition-to-word'
  const weights: Record<string, number> = { ...profile.weights }
  if (profile.inputMode === 'typing') weights['word-to-meaning-choice'] = 0
  if (profile.inputMode === 'choice') {
    weights['definition-to-word'] = Math.max(weights['definition-to-word'] || 0, 2)
    weights['word-to-meaning'] = 1
  }
  if (!familyForms(word).length) weights['word-family'] = 0
  if (!word.cloze_sentences.length) weights.cloze = 0
  if (!profile.audio) weights.listening = 0
  const entries = Object.entries(weights).filter((entry): entry is [QuestionType, number] => entry[1] > 0)
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  if (!total) return 'definition-to-word'
  let roll = randomOf(random)() * total
  for (const [type, weight] of entries) {
    roll -= weight
    if (roll <= 0) return type
  }
  return 'definition-to-word'
}

export function makeQuestion(
  word: VocabularyWord,
  words: VocabularyWord[],
  type: QuestionType,
  random: () => number = Math.random,
): Question {
  const example = exampleOf(word)
  const base = {
    id: `${word.id}-${type}-${Math.floor(random() * 100000)}`,
    wordId: word.id,
    type,
    explanation: explanationOf(word),
    example,
    confusion: word.common_confusions[0],
    related: familyForms(word),
  }
  if (type === 'cloze' && word.cloze_sentences.length) {
    const cloze = word.cloze_sentences[Math.floor(random() * word.cloze_sentences.length)]
    return {
      ...base,
      prompt: cloze.text,
      detail: 'Type the missing word.',
      accepted: [cloze.answer, word.headword],
    }
  }
  if (type === 'word-to-meaning') {
    return {
      ...base,
      prompt: word.headword,
      detail: 'In a few words, what does it mean?',
      accepted: [word.primary_definition],
      speakText: word.headword,
    }
  }
  if (type === 'word-to-meaning-choice' || type === 'listening') {
    const distractors = others(word, words, 3, random)
    const choices = shuffle(
      [
        {
          id: `${word.id}-ok`,
          text: type === 'listening' ? word.headword : word.primary_definition,
          correct: true,
        },
        ...distractors.map((item) => ({
          id: item.id,
          text: type === 'listening' ? item.headword : item.primary_definition,
          correct: false,
        })),
      ],
      random,
    )
    return {
      ...base,
      prompt: type === 'listening' ? 'Which word did you hear?' : `Which meaning fits “${word.headword}”?`,
      detail: type === 'listening' ? 'Play the word, then choose.' : undefined,
      choices,
      accepted: [word.headword],
      speakText: type === 'listening' ? word.headword : word.headword,
    }
  }
  if (type === 'usage') {
    const built = usageChoices(word, words, random)
    return {
      ...base,
      prompt: `Which sentence uses “${word.headword}” correctly?`,
      choices: built,
      accepted: [word.headword],
      explanation: built.find((choice) => choice.correct)?.note || explanationOf(word),
    }
  }
  if (type === 'word-family') {
    const forms = familyForms(word)
    const correct = forms[0] || word.headword
    const distractors = others(word, words, 3, random).map((item) => item.headword)
    return {
      ...base,
      prompt: `Which word is a form of “${word.headword}”?`,
      choices: shuffle(
        [
          { id: 'family-ok', text: correct, correct: true },
          ...distractors.map((text, index) => ({ id: `family-${index}`, text, correct: false })),
        ],
        random,
      ),
      accepted: [correct],
      explanation: `${correct} belongs with ${word.headword}. ${explanationOf(word)}`,
    }
  }
  if (type === 'sentence-production') {
    return {
      ...base,
      prompt: `Write one sentence that uses “${word.headword}” with this meaning: ${word.primary_definition}`,
      detail: 'A short sentence is enough. You will compare it with a model.',
      accepted: [word.headword],
    }
  }
  return {
    ...base,
    type: 'definition-to-word',
    prompt: word.primary_definition,
    detail: word.secondary_definitions[0] ? `Also: ${word.secondary_definitions[0]}` : 'Type the word.',
    accepted: [word.headword],
  }
}

function usageChoices(word: VocabularyWord, words: VocabularyWord[], random: () => number): Choice[] {
  const authored = word.usage_choices.filter((choice) => choice.text.trim())
  const correct = authored.find((choice) => choice.correct)
  const incorrect = authored.filter((choice) => !choice.correct)
  const correctText = correct?.text || exampleOf(word) || `${word.headword} fits when you mean ${word.primary_definition}.`
  const wrongs = [...incorrect]
  const fillers = others(word, words, 3, random)
  for (const other of fillers) {
    if (wrongs.length >= 2) break
    const swapped = other.example_sentences[0]?.text
    const text =
      swapped && swapped.toLowerCase().includes(other.headword.toLowerCase())
        ? swapped.replace(new RegExp(other.headword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), word.headword)
        : `Please ${word.headword} the ${other.headword} before judging it.`
    wrongs.push({
      text,
      correct: false,
      note: `That context does not match the meaning “${word.primary_definition}.”`,
    })
  }
  return shuffle(
    [
      { id: 'usage-ok', text: correctText, correct: true, note: correct?.note || explanationOf(word) },
      ...wrongs.slice(0, 2).map((choice, index) => ({
        id: `usage-no-${index}`,
        text: choice.text,
        correct: false,
        note: choice.note,
      })),
    ],
    random,
  )
}

export function diagnosticChoices(word: VocabularyWord, words: VocabularyWord[], random: () => number = Math.random): Choice[] {
  return makeQuestion(word, words, 'word-to-meaning-choice', random).choices || []
}
