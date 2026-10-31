import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scoreCase, summarize } from './reviewer-eval-score.mjs'

const accept = { reason: 'ok', verdict: 'accept' }
const repetitive = { reason: 'repetitive', verdict: 'retry' }

function scored(id, expected, raw) {
  return { id, expected, ...scoreCase({ expected, raw }) }
}

test('correct acceptance passes warning, reason, and schema without an explanation requirement', () => {
  const { rules } = scoreCase({ expected: accept, raw: JSON.stringify({ reason: 'ok', verdict: 'accept' }) })
  assert.deepEqual(rules, { warning: true, reason: true, schema: true, explanation: null })
})

test('rejections require a short single-line explanation', () => {
  const raw = explanation => JSON.stringify({ reason: 'repetitive', verdict: 'retry', ...(explanation === undefined ? {} : { explanation }) })
  assert.equal(scoreCase({ expected: repetitive, raw: raw('Asks for elements already named.') }).rules.explanation, true)
  assert.equal(scoreCase({ expected: repetitive, raw: raw(undefined) }).rules.explanation, false)
  assert.equal(scoreCase({ expected: repetitive, raw: raw('   ') }).rules.explanation, false)
  assert.equal(scoreCase({ expected: repetitive, raw: raw('Line one.\nLine two.') }).rules.explanation, false)
  assert.equal(scoreCase({ expected: repetitive, raw: raw('x'.repeat(241)) }).rules.explanation, false)
})

test('a wrong reason still earns warning credit when the verdict matches', () => {
  const { rules } = scoreCase({ expected: repetitive, raw: JSON.stringify({ reason: 'compound', verdict: 'retry', explanation: 'Two requests.' }) })
  assert.equal(rules.warning, true)
  assert.equal(rules.reason, false)
})

test('invalid or missing output fails schema and counts as a shown warning, like production', () => {
  for (const raw of [null, 'not json', JSON.stringify({ reason: 'ok', verdict: 'retry' }), JSON.stringify({ reason: 'ok', verdict: 'accept', extra: 1 })]) {
    assert.deepEqual(scoreCase({ expected: accept, raw }).rules, { warning: false, reason: false, schema: false, explanation: null })
    assert.equal(scoreCase({ expected: repetitive, raw }).rules.warning, true)
  }
})

test('summary reports warning precision/recall, per-reason accuracy, and a weighted score', () => {
  const summary = summarize([
    scored('true-positive', repetitive, JSON.stringify({ reason: 'repetitive', verdict: 'retry', explanation: 'Already answered.' })),
    scored('false-negative', repetitive, JSON.stringify({ reason: 'ok', verdict: 'accept' })),
    scored('true-negative', accept, JSON.stringify({ reason: 'ok', verdict: 'accept' })),
    scored('false-positive', accept, JSON.stringify({ reason: 'compound', verdict: 'retry' })),
  ])
  assert.deepEqual(summary.warning, { truePositives: 1, falsePositives: 1, falseNegatives: 1, precision: 0.5, recall: 0.5, f1: 0.5 })
  assert.deepEqual(summary.rules.warning, { passed: 2, total: 4, rate: 0.5 })
  assert.deepEqual(summary.rules.explanation, { passed: 1, total: 2, rate: 0.5 })
  assert.deepEqual(summary.reasons, {
    repetitive: { passed: 1, total: 2, rate: 0.5 },
    ok: { passed: 1, total: 2, rate: 0.5 },
  })
  assert.equal(summary.score, 57.5)
})

test('a perfect run scores 100', () => {
  const summary = summarize([
    scored('accept', accept, JSON.stringify({ reason: 'ok', verdict: 'accept' })),
    scored('retry', repetitive, JSON.stringify({ reason: 'repetitive', verdict: 'retry', explanation: 'Already answered.' })),
  ])
  assert.equal(summary.score, 100)
})
