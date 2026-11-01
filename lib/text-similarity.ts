const STOP_WORDS = new Set(('a about above after again all also an and any are as at be because been before being between both but by can could did do does doing during each for from further had has have having how i if in into is it its itself just me more most my no nor not of on once only or other our out over own same should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours ' +
  'specific specifically exactly actually really one ones kind kinds type types way ways thing things').split(' '))

const SUFFIXES = ['ations', 'ation', 'tions', 'tion', 'ments', 'ment', 'ings', 'ing', 'ies', 'ed', 'es', 's', 'e']

function stem(word: string) {
  for (const suffix of SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3 && !(suffix === 's' && word.endsWith('ss'))) {
      return suffix === 'ies' ? `${word.slice(0, -3)}y` : word.slice(0, -suffix.length)
    }
  }
  return word
}

export function contentTokens(text: string): Set<string> {
  return new Set((text.toLowerCase().replace(/['\u2019]s\b/gu, '').match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter(word => !STOP_WORDS.has(word))
    .map(stem))
}

export function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

export function withoutTokens(tokens: Set<string>, ignored: Set<string>) {
  return new Set([...tokens].filter(token => !ignored.has(token)))
}

function shared(a: Set<string>, b: Set<string>) {
  let count = 0
  for (const token of a) if (b.has(token)) count++
  return count
}

export function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0
  const common = shared(a, b)
  return common / (a.size + b.size - common)
}

// Share of the smaller set found in the larger one; catches narrowed or broadened rewordings.
export function containment(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0
  return shared(a, b) / Math.min(a.size, b.size)
}

export function isNearDuplicate(a: Set<string>, b: Set<string>, jaccardLimit: number) {
  return jaccard(a, b) >= jaccardLimit || (Math.min(a.size, b.size) >= 3 && containment(a, b) >= 0.8)
}

// Words from the subject and current topic are shared by every on-topic question, so they are ignored.
export function findRepeatedQuestion(candidate: string, previousQuestions: string[], contextText: string): string | null {
  const ignored = contentTokens(contextText)
  const normalized = normalizeText(candidate)
  const tokens = withoutTokens(contentTokens(candidate), ignored)
  for (const previous of previousQuestions) {
    if (normalizeText(previous) === normalized) return previous
    if (tokens.size && isNearDuplicate(tokens, withoutTokens(contentTokens(previous), ignored), 0.6)) return previous
  }
  return null
}
