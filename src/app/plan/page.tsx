import type { Metadata } from 'next'
import { SubjectPlanner } from '@/components/SubjectPlanner'

export const metadata: Metadata = { title: 'Subject planner - ChattyBook' }

export default function PlanPage() {
  return (
    <main className="app plan-page">
      <SubjectPlanner />
    </main>
  )
}
