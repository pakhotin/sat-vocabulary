/** Part of speech of a definition's first word. Used only as a fallback. */

const VERBS = new Set(`
absorb add adjust admit adopt agree allow annoy approve argue arrange assume attempt attribute avoid
baffle be become beg begins believing block bring build burn call calm cancel cause caused causing
change charm claim clash collect combine come compare complete conclude confirm confuse consider consist
criticize crush cut decode decorate defeat depart describe destroy detect determine devastate dig
disappear discourage divide do draw drink drive echo eliminate emphasize encourage escape establish
estimate examine exist fill filter find flinch foreshadow form found gather give go grant groom grow
guess harden hate have having held helping hesitate hinder hold impose include indicate inform insert
interrupt involve isolate judge keep lack lament land laugh lead lessen lie live lower made make mark
measure merge misunderstand mourn move multiply name named obstruct offer overcome overshadow placing
praise predict presume prevent provoke provide put reach recall reduce refer refill reject rejoice
relating remove repeat repeating replace reproduce requiring respond restore restrain reveal rise roll
ruled rushing scatter scold scorn search separate serving show showing signal sing sleep speak spend
spoil spread state stick stopping strengthen strike strip struggle substitute suggest suggesting
summarize support suppose suppress surpass survive swallow swell swing switch take tell tempt treat
trick turn undermine understand urge use using weep win wipe wrap act amount crowd
`.split(/\s+/).filter(Boolean))

const ADJECTIVES = new Set(`
able accepted adaptable ancient awkward bare based basic beautiful believable bizarre bold boring bound
brief broad builtin buried careful casual chaotic charitable cheeky clear clever common comparable
confusing contrary convincing correct crucial deep defensive delicate delicious dependent deprived
deserving dignified dirty dishonorable distrustful dominant doubtful dreary dull effective endless
energizing enormous enthusiastic essential exaggerated excessive exciting existing expressive faint
fair fake false familiar famous fat favorable fearless fluent following foregone formal frank free
friendly full functioning furious glad glowing gradual grand great greater hard harmful harmless harsh
heavy high highest historical hostile humiliating ideal idealistic imaginary imaginative immediately
implied important impossible inactive inborn independent innocent insincere inspiring intimidating
introductory irrelevant kind known lacking large learned likely loaded logical long looking loyal main
mazelike messy mild mistaken modest more most mournful moving mysterious natural nearsighted neverending
new not open optimistic ordinary outstanding outward overconfident oversimplified overused owing
passionate peaceful peculiar permanent persuasive planned playful possible practical productive
profitable prolonged proud public random real related relevant remarkable reserved respected respectful
restless rich rigid roomy rough royal rude rural secret serious severe shady shallow shapeless shared
sharp short shortlived showy silly similar sincere skilled slight slow sorry special strict strong
sturdy sudden suitable sweet systematic temporary theoretical thin thorough thoughtful threatening
thrilling tiny trying unable unaffected unaware unbiased unclear unconcerned unconventional underground
understandable uneasy uniform unimportant unjustified unnecessary unpleasant unpredictable unrestricted
unruly unselective unsettling unspoiled unstable unwise vain valuable varied violent wandering wanting
warm weak well wide widespread wise workable written absurd
`.split(/\s+/).filter(Boolean))

const NOUNS = new Set(`
a an the ability abundance abyss act agreement amount ancestry anything appearance approval arrival
aspect assumption attendant avoidance basis belief calmness clothing collection color contempt
convenience courage danger difference dignity disappointment effectiveness energy era evidence excess
expert feeling fertility flaw flexibility food foolishness fortress freedom ghost gobetween group
happening helping holiness honor hostility imitation incentive instruction introduction isolation
journalist laughter layers liking list loss man meadow meantime methods mockery model morning mouth
mystery name nature nearness notes pen people performance person point praise precision predecessor
principle question range respect rest reward rhythm room sensitivity skill sluggishness something
splendor street summary supporter tendency tone unity violation watchfulness you journalist
`.split(/\s+/).filter(Boolean))

const ADVERBS = new Set(`
always annoyingly apparently attractively clearly completely deeply densely directly easily even
excessively extremely formally gradually highly immediately mutually never openly playfully pleasantly
properly rarely regardless rigidly soon strongly stubbornly supposedly thinly too unintentionally
very well up off out over here soon
`.split(/\s+/).filter(Boolean))

const PREPOSITIONS = new Set('at by from in of on to until before about over under after with without within'.split(' '))

export function glossPos(definition) {
  const marked = definition.match(/^\((n|v|adj|adv)\.\)\s*/i)
  if (marked) {
    const map = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' }
    return map[marked[1].toLowerCase()]
  }
  if (/^(a|an|the)\s+/i.test(definition)) return 'noun'
  if (/^(very|more|most|too|so)\s+/i.test(definition)) return 'adjective'
  if (/^not\s+/i.test(definition)) return 'adjective'
  const first = definition
    .trim()
    .split(/[\s,;:]+/)[0]
    .toLowerCase()
    .replace(/[^a-z-]/g, '')
  if (!first) return null
  if (VERBS.has(first)) return 'verb'
  if (ADJECTIVES.has(first)) return 'adjective'
  if (NOUNS.has(first)) return 'noun'
  if (ADVERBS.has(first)) return 'adverb'
  if (PREPOSITIONS.has(first)) return null
  if (/(ly)$/.test(first) && first.length > 4) return 'adverb'
  if (/(ness|tion|sion|ment|ity|ism|ance|ence|tude|hood|ship|dom)$/.test(first)) return 'noun'
  if (/(ous|ious|eous|ful|less|ive|able|ible|ish|ical|ic|ary|ory|ant|ent|ine|ile)$/.test(first)) return 'adjective'
  if (/(ed|ing)$/.test(first) && first.length > 5) return 'adjective'
  return null
}
