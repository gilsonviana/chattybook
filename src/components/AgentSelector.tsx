'use client'

interface AgentSelectorProps {
  model1: string
  model2: string
  models: string[]
  onChange: (model1: string, model2: string) => void
  disabled?: boolean
}

export function AgentSelector({ model1, model2, models, onChange, disabled }: AgentSelectorProps) {
  return (
    <div className="agent-selectors">
      <label>
        Agent 1 model (opener)
        <select value={model1} onChange={event => onChange(event.target.value, model2)} disabled={disabled}>
          <option value="" disabled>Select a local model</option>
          {models.map(model => <option key={model} value={model}>{model}</option>)}
        </select>
      </label>
      <label>
        Agent 2 model (responder)
        <select value={model2} onChange={event => onChange(model1, event.target.value)} disabled={disabled}>
          <option value="" disabled>Select a local model</option>
          {models.map(model => <option key={model} value={model}>{model}</option>)}
        </select>
      </label>
    </div>
  )
}

export default AgentSelector
