import { parseQaReview } from '../lib/qa-review.mjs'

// Weights sum to 100 so the overall score reads as a percentage.
export const ruleWeights = {
  warning: 40,
  reason: 30,
  schema: 15,
  explanation: 15,
}

export const ruleDescriptions = {
  warning: 'Quality warning shown exactly when expected (invalid output counts as an unverified warning)',
  reason: 'Reason label matches the expected criterion',
  schema: 'Output is valid schema JSON with a consistent verdict and reason',
  explanation: 'Rejections include a one-line explanation of at most 240 characters',
}

/**
 * Scores one reviewer response against its expected label.
 * Rules that do not apply to a case are null and excluded from that rule's rate.
 * @param {{ expected: { reason: string, verdict: 'accept' | 'retry' }, raw: string | null }} result
 */
export function scoreCase({ expected, raw }) {
  const actual = raw === null ? null : parseQaReview(raw)
  // Production shows a warning for every follow-up that is not a valid acceptance.
  const warned = actual?.verdict !== 'accept'
  let explanation = null
  if (actual?.verdict === 'retry') {
    let rawExplanation
    try {
      rawExplanation = JSON.parse(raw).explanation
    } catch {
      rawExplanation = undefined
    }
    explanation = typeof rawExplanation === 'string' && !!actual.explanation &&
      !/[\r\n]/u.test(rawExplanation) && Array.from(rawExplanation.trim()).length <= 240
  }
  return {
    actual,
    rules: {
      warning: warned === (expected.verdict === 'retry'),
      reason: actual?.reason === expected.reason,
      schema: actual !== null,
      explanation,
    },
  }
}

function rate(passed, total) {
  return total ? passed / total : null
}

/**
 * Aggregates scored cases into per-rule rates, quality-warning precision/recall, per-reason accuracy,
 * and a weighted 0-100 score.
 * @param {Array<{ id: string, expected: { reason: string, verdict: 'accept' | 'retry' }, rules: Record<string, boolean | null> }>} cases
 */
export function summarize(cases) {
  const rules = Object.fromEntries(Object.keys(ruleWeights).map(rule => {
    const applicable = cases.filter(item => item.rules[rule] !== null)
    const passed = applicable.filter(item => item.rules[rule]).length
    return [rule, { passed, total: applicable.length, rate: rate(passed, applicable.length) }]
  }))

  const expectedWarning = item => item.expected.verdict === 'retry'
  const shownWarning = item => item.rules.warning === expectedWarning(item)
  const truePositives = cases.filter(item => expectedWarning(item) && shownWarning(item)).length
  const falsePositives = cases.filter(item => !expectedWarning(item) && shownWarning(item)).length
  const falseNegatives = cases.filter(item => expectedWarning(item) && !shownWarning(item)).length
  const precision = rate(truePositives, truePositives + falsePositives)
  const recall = rate(truePositives, truePositives + falseNegatives)
  const warning = {
    truePositives, falsePositives, falseNegatives,
    precision, recall,
    f1: precision !== null && recall !== null && precision + recall > 0 ? 2 * precision * recall / (precision + recall) : null,
  }

  const reasons = {}
  for (const item of cases) {
    const entry = reasons[item.expected.reason] ??= { passed: 0, total: 0, rate: null }
    entry.total++
    if (item.rules.reason) entry.passed++
  }
  for (const entry of Object.values(reasons)) entry.rate = rate(entry.passed, entry.total)

  // Rules with no applicable cases are left out and the remaining weights are rescaled.
  const scored = Object.entries(ruleWeights).filter(([rule]) => rules[rule].rate !== null)
  const totalWeight = scored.reduce((sum, [, weight]) => sum + weight, 0)
  const score = totalWeight
    ? Math.round(scored.reduce((sum, [rule, weight]) => sum + weight * rules[rule].rate, 0) / totalWeight * 1000) / 10
    : 0

  return { score, rules, warning, reasons }
}
