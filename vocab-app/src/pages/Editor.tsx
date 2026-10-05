import { useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { downloadText } from '../download'
import { makeQuestion } from '../questions/generate'
import { useStudy } from '../study/context'
import { parseVocabularyText, toCsv } from '../vocab/csv'
import type { ReviewStatus, VocabularyWord } from '../vocab/types'
import { validateVocabulary, validationErrors } from '../vocab/validate'

const PREVIEW_TYPES = ['definition-to-word', 'cloze', 'usage', 'word-to-meaning-choice', 'word-family'] as const

function lines(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function withExamples(word: VocabularyWord, exampleText: string): VocabularyWord {
  const status = word.review_status
  const example_sentences = lines(exampleText).map((text) => ({ text, status }))
  const cloze_sentences = example_sentences.flatMap((example) => {
    const pattern = new RegExp(`\\b${escapeRegExp(word.headword)}\\b`, 'i')
    const match = example.text.match(pattern)
    if (!match) return []
    return [{ text: example.text.replace(pattern, '_____'), answer: match[0], status: example.status }]
  })
  return { ...word, example_sentences, cloze_sentences }
}

export function Editor() {
  const study = useStudy()
  const [query, setQuery] = useState('')
  const [draftsOnly, setDraftsOnly] = useState(false)
  const [selectedId, setSelectedId] = useState(study.words[0]?.id ?? '')
  const [message, setMessage] = useState('')
  const [issues, setIssues] = useState<string[]>([])
  const selected = study.words.find((word) => word.id === selectedId) ?? study.words[0]
  const [draft, setDraft] = useState<VocabularyWord | null>(selected ?? null)
  const [exampleText, setExampleText] = useState(selected?.example_sentences.map((item) => item.text).join('\n') ?? '')

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return study.words.filter((word) => {
      if (draftsOnly && word.review_status !== 'draft') return false
      if (!needle) return true
      return word.headword.toLowerCase().includes(needle) || word.primary_definition.toLowerCase().includes(needle)
    })
  }, [draftsOnly, query, study.words])

  const draftCount = study.words.filter((word) => word.review_status === 'draft').length

  function choose(word: VocabularyWord) {
    setSelectedId(word.id)
    setDraft(word)
    setExampleText(word.example_sentences.map((item) => item.text).join('\n'))
    setMessage('')
  }

  function update(partial: Partial<VocabularyWord>) {
    setDraft((current) => (current ? { ...current, ...partial } : current))
  }

  async function save(next: VocabularyWord) {
    const prepared = withExamples(next, exampleText)
    const problems = validationErrors(
      validateVocabulary([prepared, ...study.words.filter((word) => word.id !== prepared.id)], { requireExamples: true }),
    )
    if (problems.length) {
      setIssues(problems.map((problem) => problem.message))
      return
    }
    await study.updateWord(prepared)
    setDraft(prepared)
    setIssues([])
    setMessage(`Saved ${prepared.headword}.`)
  }

  if (!draft) {
    return (
      <Layout>
        <p>No vocabulary is loaded.</p>
      </Layout>
    )
  }

  const previewWord = withExamples(draft, exampleText)
  const previews = PREVIEW_TYPES.map((type) => makeQuestion(previewWord, study.words, type)).filter((question) =>
    question.type === 'word-family' ? previewWord.word_family.length + previewWord.alternate_forms.length > 0 : true,
  )

  return (
    <Layout>
      <div className="stack">
        <h1>Word editor</h1>
        <p>
          {study.words.length} words. {draftCount} still have draft examples.
          {study.usingOverride ? ' This device is using an edited list.' : ' This device is using the built-in list.'}
        </p>
        <div className="actions">
          <button className="button secondary" type="button" onClick={() => downloadText('vocabulary.json', JSON.stringify(study.words, null, 2))}>
            Export JSON
          </button>
          <button className="button secondary" type="button" onClick={() => downloadText('vocabulary.csv', toCsv(study.words), 'text/csv')}>
            Export CSV
          </button>
          <button className="button secondary" type="button" onClick={() => downloadText('progress-anonymous.json', study.exportProgress(true))}>
            Export anonymized progress
          </button>
          <button className="button ghost" type="button" onClick={() => void study.resetWords().then(() => setMessage('Restored the built-in list.'))}>
            Restore built-in list
          </button>
        </div>
        <label className="field">
          Import CSV or JSON
          <input
            type="file"
            accept=".json,.csv,text/csv,application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              try {
                const words = parseVocabularyText(await file.text())
                const found = validateVocabulary(words, { requireExamples: true })
                const errors = found.filter((issue) => issue.level === 'error')
                if (errors.length) {
                  setIssues(errors.slice(0, 12).map((issue) => issue.message))
                  setMessage('Import stopped. Fix the errors below.')
                  return
                }
                await study.replaceWords(words)
                setIssues(found.filter((issue) => issue.level === 'warning').slice(0, 8).map((issue) => issue.message))
                setMessage(`Imported ${words.length} words.`)
                if (words[0]) choose(words[0])
              } catch (caught) {
                setMessage(caught instanceof Error ? caught.message : 'Could not read that file.')
              }
            }}
          />
        </label>
        {message ? <p role="status">{message}</p> : null}
        {issues.length ? (
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
        <div className="editor">
          <div className="stack">
            <label className="field">
              Search
              <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search words" />
            </label>
            <label className="check">
              <input type="checkbox" checked={draftsOnly} onChange={(event) => setDraftsOnly(event.target.checked)} />
              Drafts only
            </label>
            <ul className="word-list">
              {visible.slice(0, 80).map((word) => (
                <li key={word.id}>
                  <button type="button" className={word.id === draft.id ? 'button' : 'button ghost'} onClick={() => choose(word)}>
                    {word.headword}
                    {word.review_status === 'draft' ? ' · draft' : ''}
                  </button>
                </li>
              ))}
            </ul>
            {visible.length > 80 ? <p>Showing 80 of {visible.length}. Search to narrow the list.</p> : null}
          </div>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault()
              void save(draft)
            }}
          >
            <p>
              Id <code>{draft.id}</code> stays fixed so review history still matches.
            </p>
            <label className="field">
              Headword
              <input value={draft.headword} onChange={(event) => update({ headword: event.target.value })} />
            </label>
            <label className="field">
              Part of speech
              <input value={draft.part_of_speech} onChange={(event) => update({ part_of_speech: event.target.value })} />
            </label>
            <label className="field">
              Definition
              <textarea value={draft.primary_definition} rows={3} onChange={(event) => update({ primary_definition: event.target.value })} />
            </label>
            <label className="field">
              Other senses, one per line
              <textarea
                value={draft.secondary_definitions.join('\n')}
                rows={3}
                onChange={(event) => update({ secondary_definitions: lines(event.target.value) })}
              />
            </label>
            <label className="field">
              Example sentences, one per line
              <textarea value={exampleText} rows={4} onChange={(event) => setExampleText(event.target.value)} />
            </label>
            <label className="field">
              Tags, one per line
              <textarea value={draft.tags.join('\n')} rows={3} onChange={(event) => update({ tags: lines(event.target.value) })} />
            </label>
            <label className="field">
              Difficulty from 1 to 5
              <input
                type="number"
                min={1}
                max={5}
                value={draft.difficulty}
                onChange={(event) => update({ difficulty: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              Usage notes
              <textarea value={draft.usage_notes} rows={3} onChange={(event) => update({ usage_notes: event.target.value })} />
            </label>
            <label className="field">
              Memory hook
              <textarea value={draft.mnemonic} rows={2} onChange={(event) => update({ mnemonic: event.target.value })} />
            </label>
            <label className="field">
              Confusions, one per line
              <textarea
                value={draft.common_confusions.join('\n')}
                rows={3}
                onChange={(event) => update({ common_confusions: lines(event.target.value) })}
              />
            </label>
            <label className="field">
              Definition status
              <select
                value={draft.definition_status}
                onChange={(event) => update({ definition_status: event.target.value as ReviewStatus })}
              >
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
              </select>
            </label>
            <label className="field">
              Example status
              <select value={draft.review_status} onChange={(event) => update({ review_status: event.target.value as ReviewStatus })}>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
              </select>
            </label>
            <div className="actions">
              <button className="button" type="submit">
                Save word
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() =>
                  void save({
                    ...draft,
                    definition_status: 'approved',
                    review_status: 'approved',
                    example_sentences: draft.example_sentences.map((item) => ({ ...item, status: 'approved' })),
                  })
                }
              >
                Mark approved
              </button>
            </div>
          </form>
        </div>
        <section className="stack">
          <h2>Card preview</h2>
          {previews.map((question) => (
            <article key={question.type} className="card">
              <p className="kicker">{question.type}</p>
              <p>{question.prompt}</p>
              {question.choices ? (
                <ul>
                  {question.choices.map((choice) => (
                    <li key={choice.id}>
                      {choice.correct ? 'Correct: ' : ''}
                      {choice.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Answer: {question.accepted[0]}</p>
              )}
            </article>
          ))}
        </section>
      </div>
    </Layout>
  )
}
