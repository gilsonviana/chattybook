import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { Ollama } from 'ollama'
import { qaReviewFormat, qaReviewerSystemPrompt } from '../lib/qa-review.mjs'
import { ruleDescriptions, ruleWeights, scoreCase, summarize } from './reviewer-eval-score.mjs'

const cases = [
  {
    id: 'conversation-26-turn-2-new-cultural-detail',
    subject: 'New York landmarks',
    previousQuestions: ['What are some iconic landmarks of New York City?'],
    previousAnswers: ["New York's iconic landmarks are not just concrete structures, but living testaments to its history and diversity. Consider the bustling energy of Times Square, the architectural majesty of the Empire State Building, or the spiritual serenity of the Cloisters in Fort Tryon Park. These are just a few glimpses into a city that vibrates with life and offers something for everyone."],
    candidate: 'Which landmarks exemplify the intersection of American and immigrant cultures?',
    expected: { reason: 'ok', verdict: 'accept' },
  },
  {
    id: 'conversation-26-turn-3-unanswered-architecture',
    subject: 'New York enclaves',
    previousQuestions: ['What are some iconic landmarks?', 'Which landmarks exemplify American and immigrant cultures?'],
    previousAnswers: [
      "New York's iconic landmarks are not just concrete structures, but living testaments to its history and diversity. Consider the bustling energy of Times Square, the architectural majesty of the Empire State Building, or the spiritual serenity of the Cloisters in Fort Tryon Park. These are just a few glimpses into a city that vibrates with life and offers something for everyone.",
      "The intersection of American and immigrant cultures is most clearly visible in New York's ethnic enclaves. Chinatown, Little Italy, and Koreatown, for example, showcase vibrant traditions and culinary influences from across the globe. Their architecture reflects a melting pot of styles and stories, embodying the city's spirit of inclusivity.",
    ],
    candidate: 'How do these cultural influences manifest in the architectural styles of each enclave?',
    expected: { reason: 'ok', verdict: 'accept' },
  },
  {
    id: 'conversation-26-turn-4-unanswered-architectural-effect',
    subject: 'Koreatown architecture',
    previousQuestions: [
      'What are some iconic landmarks of New York City?',
      'Which landmarks exemplify the intersection of American and immigrant cultures?',
      'How do these cultural influences manifest in the specific architectural styles of each enclave?',
    ],
    previousAnswers: [
      "New York's iconic landmarks are not just concrete structures, but living testaments to its history and diversity. Consider the bustling energy of Times Square, the architectural majesty of the Empire State Building, or the spiritual serenity of the Cloisters in Fort Tryon Park. These are just a few glimpses into a city that vibrates with life and offers something for everyone.",
      "The intersection of American and immigrant cultures is most clearly visible in New York's ethnic enclaves. Chinatown, Little Italy, and Koreatown, for example, showcase vibrant traditions and culinary influences from across the globe. Their architecture reflects a melting pot of styles and stories, embodying the city's spirit of inclusivity.",
      "The architectural styles of these enclaves are a fascinating reflection of the communities that built them. Chinatown's buildings often feature traditional Chinese courtyard structures, while Little Italy reflects Italian Renaissance and Victorian architecture, and Koreatown showcases a unique blend of Korean traditional houses and modern skyscrapers.",
    ],
    candidate: 'How do Korean influences shape the architectural language of Koreatown skyscrapers?',
    expected: { reason: 'ok', verdict: 'accept' },
  },
  {
    id: 'same-topic-new-maintenance-information',
    subject: 'Koreatown architecture',
    previousQuestions: ['Which elements appear in Koreatown skyscrapers?'],
    previousAnswers: ['Some buildings incorporate Korean-inspired gables and latticework.'],
    candidate: 'How are those features maintained on newer buildings?',
    expected: { reason: 'ok', verdict: 'accept' },
  },
  {
    id: 'same-topic-new-community-impact',
    subject: 'Immigrant enclaves',
    previousQuestions: ['How do enclaves preserve cultural traditions?'],
    previousAnswers: ['Local businesses and festivals help preserve traditions and cuisine.'],
    candidate: 'How do younger residents adapt those traditions for new audiences?',
    expected: { reason: 'ok', verdict: 'accept' },
  },
  {
    id: 'conversation-26-turn-5-repeats-supplied-elements',
    subject: 'Koreatown architecture',
    previousQuestions: [
      'What are some iconic landmarks of New York City?',
      'Which landmarks exemplify the intersection of American and immigrant cultures?',
      'How do these cultural influences manifest in the specific architectural styles of each enclave?',
      "How do these influences contribute to the distinct architectural language of Koreatown's modern skyscrapers?",
    ],
    previousAnswers: [
      "New York's iconic landmarks are not just concrete structures, but living testaments to its history and diversity. Consider the bustling energy of Times Square, the architectural majesty of the Empire State Building, or the spiritual serenity of the Cloisters in Fort Tryon Park. These are just a few glimpses into a city that vibrates with life and offers something for everyone.",
      "The intersection of American and immigrant cultures is most clearly visible in New York's ethnic enclaves. Chinatown, Little Italy, and Koreatown, for example, showcase vibrant traditions and culinary influences from across the globe. Their architecture reflects a melting pot of styles and stories, embodying the city's spirit of inclusivity.",
      "The architectural styles of these enclaves are a fascinating reflection of the communities that built them. Chinatown's buildings often feature traditional Chinese courtyard structures, while Little Italy reflects Italian Renaissance and Victorian architecture, and Koreatown showcases a unique blend of Korean traditional houses and modern skyscrapers.",
      "The influence of Korean traditions can be seen in the soaring, vertically-oriented design of Koreatown's skyscrapers. They often incorporate elements of Korean architecture like gables and traditional latticework, resulting in a skyline that's both futuristic and deeply rooted in Korean cultural heritage.",
    ],
    candidate: 'Which specific elements, like gables or latticework, are inspired by traditional Korean forms?',
    expected: { reason: 'repetitive', verdict: 'retry' },
  },
  {
    id: 'repeats-supplied-enclave-list',
    subject: 'New York enclaves',
    previousQuestions: ['What neighborhoods show immigrant influence?'],
    previousAnswers: ['Chinatown, Little Italy, and Koreatown show immigrant influence.'],
    candidate: 'Which neighborhoods show immigrant influence in New York?',
    expected: { reason: 'repetitive', verdict: 'retry' },
  },
  {
    id: 'repeats-supplied-architectural-styles',
    subject: 'New York enclaves',
    previousQuestions: ['How do architectural styles differ between the enclaves?'],
    previousAnswers: ['Chinatown features courtyard structures, Little Italy has Renaissance and Victorian styles, and Koreatown blends traditional and modern buildings.'],
    candidate: 'Which architectural styles were described for each enclave?',
    expected: { reason: 'repetitive', verdict: 'retry' },
  },
  {
    id: 'same-topic-as-earlier-question-different-request',
    subject: 'Urban rain gardens',
    previousQuestions: ['How do rain gardens reduce flooding?', 'Which plants suit rain gardens?'],
    previousAnswers: ['Rain gardens hold stormwater in permeable soil.', 'Native sedges and rushes tolerate wet and dry periods.'],
    candidate: 'How often do those sedges need replacing in a city rain garden?',
    expected: { reason: 'ok', verdict: 'accept' },
  },
  {
    id: 'restates-unanswered-earlier-question',
    subject: 'Urban rain gardens',
    previousQuestions: ['How do rain gardens reduce flooding?', 'Which plants suit rain gardens?'],
    previousAnswers: ['Rain gardens are popular in many cities.', 'Native sedges and rushes tolerate wet and dry periods.'],
    candidate: 'In what ways do rain gardens help cities prevent floods?',
    expected: { reason: 'repetitive', verdict: 'retry' },
  },
  {
    id: 'compound-requests',
    subject: 'Community training programs',
    previousQuestions: ['What training is available?'],
    previousAnswers: ['Programs offer workshops and online courses.'],
    candidate: 'What training formats exist, and how are they delivered?',
    expected: { reason: 'compound', verdict: 'retry' },
  },
  {
    id: 'disconnected-topic',
    subject: 'New York landmarks',
    previousQuestions: ['What are some iconic landmarks?'],
    previousAnswers: ['Times Square and the Empire State Building are iconic landmarks.'],
    candidate: 'How do federal tax rates affect bond yields?',
    expected: { reason: 'disconnected', verdict: 'retry' },
  },
  {
    id: 'commentary-before-question',
    subject: 'Urban rain gardens',
    previousQuestions: ['Which plants suit rain gardens?'],
    previousAnswers: ['Native sedges and rushes tolerate wet and dry periods.'],
    candidate: 'Great point, sedges are clearly the best choice for cities. How often do they need replacing?',
    expected: { reason: 'not_question_only', verdict: 'retry' },
  },
  {
    id: 'answers-own-question',
    subject: 'Community training programs',
    previousQuestions: ['What training is available?'],
    previousAnswers: ['Programs offer workshops and online courses.'],
    candidate: 'Workshops tend to have higher completion rates than online courses, so which format do employers prefer?',
    expected: { reason: 'not_question_only', verdict: 'retry' },
  },
  {
    id: 'challenging-follow-up-on-claim',
    subject: 'Urban rain gardens',
    previousQuestions: ['How do rain gardens reduce flooding?'],
    previousAnswers: ['Rain gardens hold stormwater in permeable soil, which can cut neighborhood runoff by up to 30 percent.'],
    candidate: 'What evidence supports the claim that rain gardens cut runoff by 30 percent?',
    expected: { reason: 'ok', verdict: 'accept' },
  },
  {
    id: 'consequence-of-supplied-detail',
    subject: 'Community training programs',
    previousQuestions: ['What training is available?'],
    previousAnswers: ['Programs offer evening workshops and self-paced online courses.'],
    candidate: 'How do evening schedules affect attendance for working parents?',
    expected: { reason: 'ok', verdict: 'accept' },
  },
]

function localOllamaHost() {
  const url = new URL(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434')
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('OLLAMA_BASE_URL must point to a local Ollama server.')
  }
  return url.origin
}

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    json: { type: 'string' },
    'min-score': { type: 'string', default: '100' },
  },
})
const model = positionals[0]
const minScore = Number(flags['min-score'])
if (!model || !Number.isFinite(minScore) || minScore < 0 || minScore > 100) {
  console.error('Usage: npm run reviewer:eval -- <installed-local-model> [--json report.json] [--min-score 0-100]')
  process.exit(2)
}

const client = new Ollama({ host: localOllamaHost() })
const { models } = await client.list()
if (!models.some(installed => installed.name === model)) {
  console.error(`Model "${model}" is not installed locally. No model was downloaded.`)
  process.exit(2)
}
const details = await client.show({ model })
if (('remote_model' in details && details.remote_model) ||
    ('remote_host' in details && details.remote_host)) {
  console.error('Cloud models are not supported by this evaluator. Choose a local model.')
  process.exit(2)
}

function percent(value) {
  return value === null ? 'n/a' : `${Math.round(value * 1000) / 10}%`
}

const results = []
for (const testCase of cases) {
  let raw = null
  try {
    const response = await client.chat({
      model,
      messages: [
        { role: 'system', content: qaReviewerSystemPrompt },
        { role: 'user', content: JSON.stringify({
          subject: testCase.subject,
          previousQuestions: testCase.previousQuestions,
          previousAnswers: testCase.previousAnswers,
          latestAnswer: testCase.previousAnswers.at(-1),
          candidate: testCase.candidate,
        }) },
      ],
      format: qaReviewFormat,
      stream: false,
      options: { temperature: 0, num_predict: 256 },
    })
    raw = response.message.content
  } catch (error) {
    console.error(`${testCase.id}: request failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  const { actual, rules } = scoreCase({ expected: testCase.expected, raw })
  results.push({ id: testCase.id, expected: testCase.expected, actual, raw, rules })
  const failed = Object.entries(rules).filter(([, passed]) => passed === false).map(([rule]) => rule)
  console.log(`${failed.length ? 'FAIL' : 'PASS'} ${testCase.id}: expected ${testCase.expected.verdict}/${testCase.expected.reason}, got ${actual ? `${actual.verdict}/${actual.reason}` : 'invalid response'}${failed.length ? ` (failed: ${failed.join(', ')})` : ''}`)
  if (actual?.explanation) console.log(`     explanation: ${actual.explanation}`)
}

const summary = summarize(results)
const acceptCases = cases.filter(testCase => testCase.expected.verdict === 'accept').length
console.log(`\n${model}: score ${summary.score}/100 over ${cases.length} cases (${acceptCases} accept, ${cases.length - acceptCases} retry).`)
console.log('\nRules (weight, pass rate):')
for (const [rule, weight] of Object.entries(ruleWeights)) {
  const { passed, total, rate } = summary.rules[rule]
  console.log(`  ${rule.padEnd(12)} ${String(weight).padStart(3)}  ${percent(rate).padStart(6)}  (${passed}/${total})  ${ruleDescriptions[rule]}`)
}
console.log(`\nQuality warning: precision ${percent(summary.warning.precision)}, recall ${percent(summary.warning.recall)}, F1 ${percent(summary.warning.f1)} (${summary.warning.falsePositives} false warnings, ${summary.warning.falseNegatives} missed warnings).`)
console.log('Reason accuracy by expected label:')
for (const [reason, { passed, total, rate }] of Object.entries(summary.reasons)) {
  console.log(`  ${reason.padEnd(18)} ${percent(rate).padStart(6)}  (${passed}/${total})`)
}

if (flags.json) {
  await writeFile(flags.json, `${JSON.stringify({
    model,
    createdAt: new Date().toISOString(),
    // Lets saved reports be compared across prompt revisions.
    promptSha256: createHash('sha256').update(qaReviewerSystemPrompt).digest('hex'),
    ...summary,
    cases: results,
  }, null, 2)}\n`)
  console.log(`\nReport written to ${flags.json}.`)
}
if (summary.score < minScore) process.exitCode = 1
