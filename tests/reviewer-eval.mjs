import { Ollama } from 'ollama'
import { qaReviewFormat, qaReviewerSystemPrompt } from '../lib/qa-review.mjs'

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
]

function localOllamaHost() {
  const url = new URL(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434')
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('OLLAMA_BASE_URL must point to a local Ollama server.')
  }
  return url.origin
}

function parseLabel(content) {
  try {
    const result = JSON.parse(content)
    if (result && ['accept', 'retry'].includes(result.verdict) &&
        ['ok', 'disconnected', 'repetitive', 'compound', 'not_question_only'].includes(result.reason)) {
      return { reason: result.reason, verdict: result.verdict }
    }
  } catch {
    return null
  }
  return null
}

const model = process.argv[2]
if (!model) {
  console.error('Usage: npm run reviewer:eval -- <installed-local-model>')
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

let correct = 0
for (const testCase of cases) {
  let actual = null
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
    actual = parseLabel(response.message.content)
  } catch (error) {
    console.error(`${testCase.id}: request failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  const passed = actual?.reason === testCase.expected.reason && actual?.verdict === testCase.expected.verdict
  if (passed) correct++
  console.log(`${passed ? 'PASS' : 'FAIL'} ${testCase.id}: expected ${testCase.expected.verdict}/${testCase.expected.reason}, got ${actual ? `${actual.verdict}/${actual.reason}` : 'invalid response'}`)
}

console.log(`\n${model}: ${correct}/${cases.length} correct; ${cases.length - correct} mismatches (${cases.length / 2} accept, ${cases.length / 2} retry cases).`)
if (correct !== cases.length) process.exitCode = 1
