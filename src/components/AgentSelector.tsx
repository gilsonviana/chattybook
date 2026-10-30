'use client'

import { PERSONAS, type Persona } from '../../lib/personas'

interface AgentSelectorProps {
  model1: string
  model2: string
  persona1: Persona
  persona2: Persona
  models: string[]
  onChange: (model1: string, model2: string, persona1: Persona, persona2: Persona) => void
  disabled?: boolean
}

export function AgentSelector({ model1, model2, persona1, persona2, models, onChange, disabled }: AgentSelectorProps) {
  return (
    <div className="agent-selectors">
      <div className="agent-config">
        <label>
          Agent 1 model (opener)
          <select value={model1} onChange={event => onChange(event.target.value, model2, persona1, persona2)} disabled={disabled}>
            <option value="" disabled>Select a local model</option>
            {models.map(model => <option key={model} value={model}>{model}</option>)}
          </select>
        </label>
        <label>
          Agent 1 persona
          <select value={persona1} onChange={event => onChange(model1, model2, event.target.value as Persona, persona2)} disabled={disabled}>
            {PERSONAS.map(persona => <option key={persona} value={persona}>{persona}</option>)}
          </select>
        </label>
      </div>
      <div className="agent-config">
        <label>
          Agent 2 model (responder)
          <select value={model2} onChange={event => onChange(model1, event.target.value, persona1, persona2)} disabled={disabled}>
            <option value="" disabled>Select a local model</option>
            {models.map(model => <option key={model} value={model}>{model}</option>)}
          </select>
        </label>
        <label>
          Agent 2 persona
          <select value={persona2} onChange={event => onChange(model1, model2, persona1, event.target.value as Persona)} disabled={disabled}>
            {PERSONAS.map(persona => <option key={persona} value={persona}>{persona}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}

export default AgentSelector
