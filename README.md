# ChattyBook

Two agents discuss a subject using **local Ollama models only**, through the Ollama
JavaScript SDK. Enter a subject, select two installed models (or the same model for
both agents), and start. The default is **5 turns**, where each turn includes one
response from each agent: **10 generated responses** in total.

## Run locally

1. Install and start [Ollama](https://ollama.com). If it is not already running:
   ```sh
   ollama serve
   ```
2. Install a local chat model:
   ```sh
   ollama pull qwen3.5:4b
   ```
3. Install dependencies and create `.env` in the project root:
   ```sh
   npm install
   ```
   ```dotenv
   DATABASE_URL="file:./database.sqlite"
   OLLAMA_BASE_URL="http://127.0.0.1:11434"
   ```
   SQLite paths are relative to `prisma/schema.prisma`. The Ollama URL is optional
   and defaults to the loopback address above; remote servers and cloud models are
   not supported.
4. Generate the database client, apply migrations, and start Next.js:
   ```sh
   npm run db:setup
   npm run dev
   ```
5. Open [localhost:3000](http://localhost:3000). Confirm the Ollama connection and
   available models, enter a subject, choose a model and persona for each agent,
   then select **Start dialogue**. Personas can be set independently to None,
   Student, Professor, Minister, Politician, or Historian.

Each answer appears as soon as its model request completes. The first request can
take longer while Ollama loads model weights. Existing answers stay visible while
the next agent thinks. Conversations and completion status are saved in SQLite.
If generation fails, the actual error is displayed; **Retry / continue dialogue**
reloads persisted messages and resumes without adding a fake or empty answer.

## Checks and API

- `GET /api/ollama/health`: `{ running, version }` (200), or `{ running: false, error }` (503).
- `GET /api/ollama/models`: `{ models: string[] }` containing installed local model
  names, or `{ models: [], error }` (503). An empty successful list means no models
  are installed. Use **Refresh models** after installing a model or starting Ollama.
- `POST /api/conversation`: `{ subject, model1, model2, persona1?, persona2?, totalTurns? }`.
   Personas default to `None` and can be `Student`, `Professor`, `Minister`,
   `Politician`, or `Historian`. `totalTurns` defaults to 5 and accepts integers
   from 1 to 100. Returns a new conversation with no placeholder messages.
- `POST /api/chat`: `{ conversationId, expectedMessageCount }`. Generates and saves
  exactly one response. The server chooses the next agent, constructs history from
  that agent's perspective, and marks the conversation complete after both agents
  have responded for every turn. Concurrent, stale, or completed requests get 409.
- `GET /api/conversation/:id`: retrieves the saved conversation and ordered messages.

If Ollama is unavailable, start it locally. If no models appear, run `ollama list`
and install a chat-capable model. Model, connection, and database errors are
reported separately rather than being replaced with an "Ollama not connected"
message. Requests time out after 5 seconds for connection/model checks and 5
minutes for generation.

## Validation

```sh
npm run lint
npm test
```

`npm test` builds the production app and tests the real HTTP routes against a
controlled local Ollama-compatible fixture and a temporary SQLite database. It
covers default five-turn dialogues, history/agent ordering, persisted completion,
validation, concurrency, retries, empty output, offline health, and model listing.
The fixture does not download models or touch your conversation database.
