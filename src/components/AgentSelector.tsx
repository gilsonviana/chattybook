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
      <div className="agent-card agent1">
        <h3 className="agent-card-title">Agent 1 <span>Opener</span></h3>
        <label>
          <span className="sr-only">Agent 1 </span>Model
          <select value={model1} onChange={event => onChange(event.target.value, model2, persona1, persona2)} disabled={disabled}>
            <option value="" disabled>Select a local model</option>
            {models.map(model => <option key={model} value={model}>{model}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Agent 1 </span>Persona
          <select value={persona1} onChange={event => onChange(model1, model2, event.target.value as Persona, persona2)} disabled={disabled}>
            {PERSONAS.map(persona => <option key={persona} value={persona}>{persona}</option>)}
          </select>
        </label>
      </div>
      <div className="agent-card agent2">
        <h3 className="agent-card-title">Agent 2 <span>Responder</span></h3>
        <label>
          <span className="sr-only">Agent 2 </span>Model
          <select value={model2} onChange={event => onChange(model1, event.target.value, persona1, persona2)} disabled={disabled}>
            <option value="" disabled>Select a local model</option>
            {models.map(model => <option key={model} value={model}>{model}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Agent 2 </span>Persona
          <select value={persona2} onChange={event => onChange(model1, model2, persona1, event.target.value as Persona)} disabled={disabled}>
            {PERSONAS.map(persona => <option key={persona} value={persona}>{persona}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}

export default AgentSelector
