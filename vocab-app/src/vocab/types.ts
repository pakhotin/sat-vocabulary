export type ReviewStatus = 'draft' | 'approved'

export interface ExampleSentence {
  text: string
  status: ReviewStatus
}

export interface ClozeSentence {
  text: string
  answer: string
  status: ReviewStatus
}

export interface UsageChoice {
  text: string
  correct: boolean
  note?: string
}

export interface VocabularyWord {
  id: string
  headword: string
  alternate_forms: string[]
  part_of_speech: string
  pronunciation: string
  audio_url: string
  primary_definition: string
  secondary_definitions: string[]
  definition_status: ReviewStatus
  simple_definition: string
  example_sentences: ExampleSentence[]
  cloze_sentences: ClozeSentence[]
  synonyms: string[]
  near_synonyms: string[]
  antonyms: string[]
  collocations: string[]
  word_family: string[]
  etymology: string
  register: string
  usage_notes: string
  common_confusions: string[]
  mnemonic: string
  tags: string[]
  difficulty: number
  source_or_editor: string
  review_status: ReviewStatus
  question_id: string
  answer_role: string
  compare_with: string[]
  usage_choices: UsageChoice[]
}

export type Minutes = 5 | 10 | 15 | 25
export type Pace = 'gentle' | 'standard' | 'intensive'
export type InputMode = 'typing' | 'choice' | 'mixed'
export type EducationLevel = '' | 'middle' | 'high' | 'college' | 'adult'
export type AnswerResult = 'correct' | 'partial' | 'incorrect'
export type MasteryLevel = 'new' | 'learning' | 'reviewing' | 'mastered' | 'needs-attention'

export type QuestionType =
  | 'definition-to-word'
  | 'word-to-meaning'
  | 'word-to-meaning-choice'
  | 'cloze'
  | 'usage'
  | 'word-family'
  | 'listening'
  | 'sentence-production'

export interface QuestionWeights {
  'definition-to-word': number
  'word-to-meaning': number
  'word-to-meaning-choice': number
  cloze: number
  usage: number
  'word-family': number
  listening: number
}

export interface Profile {
  id: 'local'
  educationLevel: EducationLevel
  dailyMinutes: Minutes
  pace: Pace
  inputMode: InputMode
  audio: boolean
  sound: boolean
  fontScale: number
  reducedMotion: boolean
  streakProtection: boolean
  diagnosticDone: boolean
  weights: QuestionWeights
  createdAt: string
}

export interface ReviewEvent {
  at: string
  rating: number
  questionType: string
  result: AnswerResult
}

export interface ReviewRecord {
  wordId: string
  due: string
  cardJson: string
  lastRating: number | null
  successCount: number
  history: ReviewEvent[]
}

export interface StudyMeta {
  id: 'local'
  xp: number
  streak: number
  lastStudyDate: string | null
  freezeAvailable: boolean
  studyDaysSinceFreeze: number
  freezeEverUsed: boolean
  favorites: string[]
  newWordsDate: string | null
  newWordsToday: number
  typedCorrect: number
  sessionsCompleted: number
  lastFinishedSessionId: string | null
}

export const defaultWeights = (): QuestionWeights => ({
  'definition-to-word': 5,
  'word-to-meaning': 3,
  'word-to-meaning-choice': 2,
  cloze: 4,
  usage: 3,
  'word-family': 2,
  listening: 1,
})

export function defaultProfile(): Profile {
  return {
    id: 'local',
    educationLevel: '',
    dailyMinutes: 15,
    pace: 'standard',
    inputMode: 'mixed',
    audio: true,
    sound: false,
    fontScale: 1,
    reducedMotion: false,
    streakProtection: true,
    diagnosticDone: false,
    weights: defaultWeights(),
    createdAt: new Date().toISOString(),
  }
}

export function defaultMeta(): StudyMeta {
  return {
    id: 'local',
    xp: 0,
    streak: 0,
    lastStudyDate: null,
    freezeAvailable: true,
    studyDaysSinceFreeze: 0,
    freezeEverUsed: false,
    favorites: [],
    newWordsDate: null,
    newWordsToday: 0,
    typedCorrect: 0,
    sessionsCompleted: 0,
    lastFinishedSessionId: null,
  }
}
