import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { enrichment, archaicPos } from './enrichment.mjs'
import { glossPos } from './gloss-pos.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.resolve(root, '..')
const mdPath = path.join(repo, 'resources', 'SAT_Reading_and_Writing_Vocabulary.md')
const dataDir = path.join(root, 'data')
const publicDir = path.join(root, 'public')

const HEAD_POS = {
  aloft: 'adverb',
  awry: 'adverb',
  akin: 'adjective',
  apt: 'adjective',
  biennial: 'adjective',
  complement: 'verb',
  contemporary: 'noun',
  contrivance: 'noun',
  corollary: 'noun',
  corpulent: 'adjective',
  counterfactual: 'adjective',
  counterfeit: 'adjective',
  deliberate: 'adjective',
  diffuse: 'verb',
  dupe: 'verb',
  ephemeral: 'adjective',
  interim: 'noun',
  intermediary: 'noun',
  intimate: 'verb',
  manifest: 'adjective',
  mercantile: 'adjective',
  obscure: 'adjective',
  refrain: 'verb',
  shroud: 'noun',
  slumber: 'verb',
  uniform: 'adjective',
  utter: 'verb',
  authenticate: 'verb',
  couplet: 'noun',
  defunct: 'adjective',
  diabolical: 'adjective',
  expedite: 'verb',
  henceforth: 'adverb',
  hitherto: 'adverb',
  hone: 'verb',
  imminent: 'adjective',
  impending: 'adjective',
  inherent: 'adjective',
  labyrinthine: 'adjective',
  nominal: 'adjective',
  notwithstanding: 'preposition',
  pedestrian: 'adjective',
  peripheral: 'adjective',
  precursor: 'noun',
  refute: 'verb',
  sheer: 'adjective',
  signatory: 'noun',
  squander: 'verb',
  tangential: 'adjective',
  terrestrial: 'adjective',
  thereby: 'adverb',
  undermine: 'verb',
  unison: 'noun',
  whet: 'verb',
}

function hash(value) {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function slugify(head) {
  const slug = head
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'word'
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function splitSenses(definition) {
  return definition
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
}

function stripMarker(sense) {
  const match = sense.match(/^\((n|v|adj|adv)\.\)\s*/i)
  if (!match) return { marker: null, text: sense }
  const map = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' }
  return { marker: map[match[1].toLowerCase()], text: sense.slice(match[0].length).trim() }
}

function parseWordCell(cell) {
  const bold = cell.match(/\*\*(.+?)\*\*/)
  if (!bold) return null
  const headRaw = bold[1].trim()
  const rest = cell.replace(/\*\*[^*]+\*\*/, '')
  const italicForms = [...rest.matchAll(/\*([^*]+)\*/g)].map((match) => match[1].trim()).filter(Boolean)
  if (headRaw.includes(',') && !/\band\b/i.test(headRaw)) {
    const parts = headRaw.split(',').map((part) => part.trim()).filter(Boolean)
    return { headword: parts[0], alternate_forms: [...parts.slice(1), ...italicForms] }
  }
  return { headword: headRaw, alternate_forms: italicForms }
}

function inferPos(headword, definition, section) {
  if (archaicPos[headword]) return archaicPos[headword]
  if (HEAD_POS[headword]) return HEAD_POS[headword]
  const fromGloss = glossPos(definition)
  if (fromGloss) return fromGloss
  if (section.startsWith('Old-fashioned') && /^you\b/i.test(definition)) return 'pronoun'
  if (headword.includes(' ')) return 'phrase'
  const bare = headword.toLowerCase().replace(/[^a-z]/g, '')
  if (/(ly)$/.test(bare) && bare.length > 4) return 'adverb'
  if (/(ness|tion|sion|ment|ity|ism|ance|ence|tude|hood|ship)$/.test(bare)) return 'noun'
  if (/(ous|ious|eous|ful|less|ive|able|ible|ish|ic)$/.test(bare)) return 'adjective'
  return null
}

function draftSentence(headword, pos, primary) {
  const gloss = primary.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  const readable = gloss.charAt(0).toLowerCase() + gloss.slice(1).replace(/\.$/, '')
  const pick = hash(headword) % 3
  if (pos === 'verb') {
    return [
      `To ${headword} is to ${readable}.`,
      `In the passage, things start to ${headword}: they ${readable}.`,
      `The writer uses ${headword} for a change that will ${readable}.`,
    ][pick]
  }
  if (pos === 'adjective') {
    return [
      `If something is ${headword}, it is ${readable}.`,
      `The text calls it ${headword}, meaning ${readable}.`,
      `A ${headword} case is one that is ${readable}.`,
    ][pick]
  }
  if (pos === 'adverb') {
    return `The narrator says it happened ${headword}, which means ${readable}.`
  }
  if (pos === 'pronoun' || pos === 'contraction' || pos === 'phrase' || pos === 'conjunction' || pos === 'preposition') {
    return `The passage uses “${headword}” to mean ${readable}.`
  }
  const article = /^[aeiou]/i.test(headword) ? 'an' : 'a'
  return [
    `The passage refers to ${article} ${headword}, ${readable}.`,
    `What matters in the sentence is ${article} ${headword}: ${readable}.`,
    `Readers meet ${article} ${headword}, meaning ${readable}.`,
  ][pick]
}

function inflections(form) {
  if (!/^[A-Za-z][A-Za-z'-]*$/.test(form)) return []
  const extras = [`${form}s`, `${form}es`, `${form}ed`, `${form}d`, `${form}ing`]
  if (form.endsWith('e')) extras.push(`${form.slice(0, -1)}ing`)
  if (form.endsWith('y')) {
    extras.push(`${form.slice(0, -1)}ies`, `${form.slice(0, -1)}ied`)
  }
  return extras
}

function formPattern(form) {
  const escaped = escapeRegExp(form)
  const start = /^\w/.test(form) ? '\\b' : ''
  const end = /\w$/.test(form) ? '\\b' : ''
  return new RegExp(`${start}${escaped}${end}`, 'i')
}

function blankForm(sentence, forms) {
  const expanded = [...forms, ...forms.flatMap(inflections)]
  const ordered = [...new Set(expanded)].sort((a, b) => b.length - a.length)
  for (const form of ordered) {
    const pattern = formPattern(form)
    if (pattern.test(sentence)) {
      const match = sentence.match(pattern)
      return { text: sentence.replace(pattern, '_____'), answer: match[0] }
    }
  }
  return null
}

function difficultyFor(headword, register, extra) {
  if (extra) return extra
  if (register === 'archaic') return 4
  const length = headword.replace(/[^a-z]/gi, '').length
  if (length >= 12) return 4
  if (length >= 9) return 3
  return 2
}

function parseMarkdown(text) {
  let section = ''
  const words = []
  const unparsed = []
  for (const line of text.split(/\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/)
    if (heading) {
      section = heading[1].trim()
      continue
    }
    if (!line.startsWith('| **')) continue
    const row = line.match(
      /^\|\s*(.+?)\s*\|\s*(.*?)\s*\|\s*(?:`([0-9a-f]+)`\s*(✓|✗)?|(not in bank))\s*\|\s*$/,
    )
    if (!row) {
      unparsed.push(line)
      continue
    }
    const parsed = parseWordCell(row[1])
    if (!parsed) {
      unparsed.push(line)
      continue
    }
    const definition = row[2].trim()
    const questionId = row[3] || ''
    const mark = row[4] || ''
    const notInBank = Boolean(row[5])
    const senses = splitSenses(definition).map(stripMarker)
    const primary = senses[0]?.text || definition
    const secondary = senses.slice(1).map((sense) => sense.text).filter(Boolean)
    const otherPos = senses.slice(1).map((sense) => sense.marker).filter(Boolean)
    const extra = enrichment[parsed.headword]
    const register = section.startsWith('Old-fashioned')
      ? 'archaic'
      : extra?.register || (/\bold use\b|\bold-fashioned\b|\bhistorical\b/i.test(definition) ? 'literary' : '')
    const pos = extra?.part_of_speech || inferPos(parsed.headword, definition, section)
    const letter = /^[A-Z]$/.test(section) ? section.toLowerCase() : section.startsWith('Old-fashioned') ? 'archaic' : 'other'
    const tags = [`letter-${letter}`]
    if (register === 'archaic') tags.push('archaic')
    if (mark === '✓') tags.push('correct-answer')
    else if (mark === '✗') tags.push('wrong-answer')
    else tags.push('passage-or-stem')
    if (notInBank) tags.push('not-in-bank')
    if (secondary.length) tags.push('multi-sense')
    const alternate = [...new Set([...(parsed.alternate_forms || []), ...(extra?.word_family || [])])]
    const generated = draftSentence(parsed.headword, pos || 'noun', primary)
    const exampleTexts = extra?.examples?.length ? extra.examples : [generated]
    const exampleStatus = extra?.examples?.length ? 'approved' : 'draft'
    const examples = exampleTexts.map((text) => ({ text, status: exampleStatus }))
    const clozes = []
    for (const example of examples) {
      const cloze = blankForm(example.text, [parsed.headword, ...parsed.alternate_forms])
      if (cloze) clozes.push({ text: cloze.text, answer: cloze.answer, status: example.status })
    }
    let usage = extra?.usage_notes || ''
    if (otherPos.length) {
      const note = `The source also lists ${otherPos.join(' and ')} ${otherPos.length > 1 ? 'senses' : 'sense'}.`
      usage = usage ? `${usage} ${note}` : note
    }
    const idBase = slugify(parsed.headword)
    words.push({
      id: idBase,
      headword: parsed.headword,
      alternate_forms: parsed.alternate_forms,
      part_of_speech: pos || '',
      pronunciation: '',
      audio_url: '',
      primary_definition: primary,
      secondary_definitions: secondary,
      definition_status: 'approved',
      simple_definition: extra?.simple_definition || '',
      example_sentences: examples,
      cloze_sentences: clozes,
      synonyms: extra?.synonyms || [],
      near_synonyms: extra?.near_synonyms || [],
      antonyms: extra?.antonyms || [],
      collocations: extra?.collocations || [],
      word_family: alternate,
      etymology: extra?.etymology || '',
      register,
      usage_notes: usage,
      common_confusions: extra?.common_confusions || [],
      mnemonic: extra?.mnemonic || '',
      tags,
      difficulty: difficultyFor(parsed.headword, register, extra?.difficulty),
      source_or_editor: extra
        ? 'Definitions from SAT Reading and Writing Vocabulary. Examples and notes written for this app.'
        : 'Definitions from SAT Reading and Writing Vocabulary. Example sentence drafted for this app and not yet editor-approved.',
      review_status: extra?.examples?.length ? 'approved' : 'draft',
      question_id: questionId,
      answer_role: mark === '✓' ? 'correct' : mark === '✗' ? 'incorrect' : notInBank ? 'added' : 'passage',
      compare_with: extra?.compare_with || [],
      usage_choices: extra?.usage_choices || [],
    })
  }
  return { words, unparsed }
}

function uniqueIds(words) {
  const seen = new Map()
  for (const word of words) {
    const count = seen.get(word.id) || 0
    seen.set(word.id, count + 1)
    if (count > 0) word.id = `${word.id}-${count + 1}`
  }
}

function validate(words) {
  const errors = []
  const seen = new Map()
  for (const word of words) {
    const key = word.headword.toLowerCase()
    if (seen.has(key)) errors.push(`Duplicate headword: ${word.headword}`)
    seen.set(key, true)
    if (!word.primary_definition) errors.push(`Missing definition: ${word.headword}`)
    if (!word.example_sentences?.length) errors.push(`Missing example: ${word.headword}`)
    if (!word.part_of_speech) errors.push(`Missing part of speech: ${word.headword}`)
    if (!word.cloze_sentences?.length) errors.push(`Missing cloze: ${word.headword}`)
    const pos = word.part_of_speech
    const kinds = ['noun', 'verb', 'adjective', 'adverb'].filter((kind) => new RegExp(`\\b${kind}\\b`).test(pos))
    if (kinds.length > 1 && !word.tags.includes('multi-pos')) {
      errors.push(`Contradictory part of speech: ${word.headword} (${pos})`)
    }
  }
  return errors
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(' | ') : value == null ? '' : String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

const CSV_COLUMNS = [
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
]

function exampleCell(word) {
  return word.example_sentences.map((item) => item.text).join(' | ')
}

function clozeCell(word) {
  return word.cloze_sentences.map((item) => item.text).join(' | ')
}

function toCsv(words) {
  const lines = [CSV_COLUMNS.join(',')]
  for (const word of words) {
    const row = CSV_COLUMNS.map((column) => {
      if (column === 'example_sentences') return csvEscape(exampleCell(word))
      if (column === 'cloze_sentences') return csvEscape(clozeCell(word))
      return csvEscape(word[column])
    })
    lines.push(row.join(','))
  }
  return `${lines.join('\n')}\n`
}

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i]
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const name = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, crc])
}

function iconPng(size) {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  const paint = (x, y, red, green, blue, alpha) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const offset = y * stride + 1 + x * 4
    raw[offset] = red
    raw[offset + 1] = green
    raw[offset + 2] = blue
    raw[offset + 3] = alpha
  }
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0
    for (let x = 0; x < size; x += 1) {
      const dx = x - size / 2
      const dy = y - size / 2
      const inside = Math.sqrt(dx * dx + dy * dy) < size * 0.46
      paint(x, y, inside ? 30 : 0, inside ? 77 : 0, inside ? 56 : 0, inside ? 255 : 0)
    }
  }
  const thick = Math.max(3, Math.round(size / 18))
  const span = Math.round(size * 0.34)
  for (let i = 0; i < span; i += 1) {
    const y = Math.round(size * 0.28) + i
    const left = Math.round(size * 0.3) + Math.round(i * 0.52)
    const right = Math.round(size * 0.7) - Math.round(i * 0.52)
    for (let t = -thick; t <= thick; t += 1) {
      paint(left + t, y, 244, 240, 230, 255)
      paint(right + t, y, 244, 240, 230, 255)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function templateWord() {
  return {
    id: 'example-headword',
    headword: 'example',
    alternate_forms: ['examples'],
    part_of_speech: 'noun',
    pronunciation: '',
    audio_url: '',
    primary_definition: 'a sample entry you can replace',
    secondary_definitions: [],
    definition_status: 'draft',
    simple_definition: '',
    example_sentences: [{ text: 'Replace this example sentence with a natural one that uses example.', status: 'draft' }],
    cloze_sentences: [{ text: 'Replace this _____ sentence with a natural one.', answer: 'example', status: 'draft' }],
    synonyms: [],
    near_synonyms: [],
    antonyms: [],
    collocations: [],
    word_family: ['examples'],
    etymology: '',
    register: '',
    usage_notes: '',
    common_confusions: [],
    mnemonic: '',
    tags: ['template'],
    difficulty: 2,
    source_or_editor: 'template',
    review_status: 'draft',
    question_id: '',
    answer_role: '',
    compare_with: [],
    usage_choices: [],
  }
}

const text = fs.readFileSync(mdPath, 'utf8')
const { words, unparsed } = parseMarkdown(text)
uniqueIds(words)
const missingEnrichment = Object.keys(enrichment).filter((key) => !words.some((word) => word.headword === key))
const errors = validate(words)
if (unparsed.length || missingEnrichment.length || errors.length) {
  console.error(JSON.stringify({ unparsed, missingEnrichment, errors: errors.slice(0, 80), errorCount: errors.length }, null, 2))
  process.exit(1)
}
fs.mkdirSync(dataDir, { recursive: true })
fs.mkdirSync(publicDir, { recursive: true })
fs.writeFileSync(path.join(dataDir, 'vocabulary.json'), `${JSON.stringify(words, null, 2)}\n`)
fs.writeFileSync(path.join(dataDir, 'vocabulary.csv'), toCsv(words))
const template = [templateWord()]
fs.writeFileSync(path.join(dataDir, 'vocabulary.template.json'), `${JSON.stringify(template, null, 2)}\n`)
fs.writeFileSync(path.join(dataDir, 'vocabulary.template.csv'), toCsv(template))
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="SAT Vocabulary">
  <circle cx="32" cy="32" r="30" fill="#1e4d38"/>
  <path d="M18 20 L32 46 L46 20" fill="none" stroke="#f4f0e6" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`)
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), iconPng(192))
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), iconPng(512))
const drafts = words.filter((word) => word.review_status === 'draft').length
const approved = words.length - drafts
console.log(`Wrote ${words.length} words (${approved} approved, ${drafts} draft examples).`)
