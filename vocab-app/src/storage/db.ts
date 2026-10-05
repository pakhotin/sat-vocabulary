import Dexie, { type Table } from 'dexie'
import type { Profile, ReviewRecord, StudyMeta, VocabularyWord } from '../vocab/types'

export interface VocabRecord {
  id: string
  words: VocabularyWord[]
}

class StudyDB extends Dexie {
  profile!: Table<Profile, string>
  reviews!: Table<ReviewRecord, string>
  meta!: Table<StudyMeta, string>
  vocab!: Table<VocabRecord, string>
  constructor() {
    super('sat-vocabulary')
    this.version(1).stores({
      profile: 'id',
      reviews: 'wordId, due',
      meta: 'id',
      vocab: 'id',
    })
  }
}

export const db = new StudyDB()
