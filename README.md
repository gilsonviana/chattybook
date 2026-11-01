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
   optionally enable Q&A mode and choose a response length, then select **Plan
   topics**. Personas can be set independently to None, Student, Professor,
   Pastor, Politician, or Historian. Each provides a distinct role-appropriate
   voice and subject lens. Response length applies to both agents.
   Short prompts require exactly one paragraph with at most 25 words; Medium
   allows up to 3 paragraphs; Long allows up to 7 paragraphs in discussion mode only.
   These are prompt instructions, not output validation; models may exceed the limits.
   In Q&A mode, Agent 1 asks one question per turn; Agent 2 is instructed to answer
   only that question, without tangents or additional questions. Personas affect
   voice, not question scope or length. Switching to Q&A or restoring Q&A settings
   changes a Long selection to Medium.
   The first question opens the subject. Follow-ups build on Agent 2's latest
   answer, with connected branches to other aspects of the subject allowed.
   **Devil's advocate** makes Agent 1 skeptical: in discussion mode it questions
   Agent 2's claims and tries to refute them; in Q&A mode its questions challenge a
   specific claim or assumption in Agent 2's latest answer (still one question per
   turn). Agent 2's instructions are unchanged.
6. On the **Subject planner** page, Agent 1's model drafts one ordered topic per
   turn (in batches of up to 15), progressing from foundations toward trade-offs
   and open questions. Review it, then choose **Confirm & Start**, **Regenerate**
   (asks for a fresh set that does not rephrase the current one; a failure keeps
   the current draft), or **Back** (returns to the setup form with every setting,
   including the subject, intact). Drafts are not saved; the plan is stored only
   when the conversation is created. Malformed, short, or overlapping drafts are
   repaired at most twice per batch within a three-minute budget per batch.

During a planned dialogue, turn N focuses on topic N. The conversation page shows
the plan with covered, current, and upcoming topics, computed from saved messages,
so failed, cancelled, or interrupted turns never advance it. Agent 1 sees the
current topic, covered topics, and the next topic; in discussion mode both agents
stay on the current topic and build on earlier arguments. Agent 1's Q&A questions
are also rejected when their content words (ignoring subject and topic words)
largely match an earlier question; after three rejected drafts the turn fails
with 502 and can be retried. Conversations created before planning existed have no
plan and keep their original prompts.

Each answer appears when generation finishes. The first request can
take longer while Ollama loads model weights. Existing answers stay visible while
the next agent thinks. Conversations and completion status are saved in SQLite.
Each conversation has its own `/conversation/{id}` URL, and the home page lists
previous conversations so they can be reopened. Opening an unfinished saved chat
restores its messages without starting generation; select **Retry / continue
dialogue** to resume it.
**Fork** (on the conversation page or in a history item's menu) copies a
conversation's subject and settings into the setup form so you can change models
or settings before starting. When you plan topics, the new Agent 1 model summarizes the
source dialogue into at most 10 key points (long transcripts are summarized in
chunks of about 8,000 characters, each folded into the running summary, so no
request contains the whole transcript). Both agents receive these key points with
an instruction not to repeat them; they appear under **Key points carried over**
on the conversation page. The new conversation starts without messages and links
back to its source; the link is removed if the source is deleted, but the summary
is kept. The original conversation's header shows how many times it was forked,
and a **Continue reading** section at the bottom links to each fork. Forking an
empty conversation skips the summary. If summarization fails,
no conversation is created. Forking requires the source's models to be installed
locally.
**Summarize** at the bottom of a conversation is enabled once it is completed
(including a stopped dialogue with saved messages). Its joined arrow button opens
the installed local-model menu, defaulting to Agent 1's model. The summary contains
up to 10 concise key points from this conversation's messages, not its inherited
fork context. The latest successful summary and model are saved and restored when
reopening the conversation. Select **Summarize** again to regenerate; a failed
attempt leaves the previous summary intact. Long transcripts use the same chunked
approach as fork summaries, and the selected model must still be installed.
**Export to PDF** on the conversation page opens the browser's print dialog with a
print layout of the dialogue and any saved summary; choose **Save as PDF** as the destination.
If generation fails, the actual error is displayed; **Retry / continue dialogue**
reloads persisted messages and resumes without adding a fake or empty answer.

Q&A follow-ups use prompts grounded in Agent 2's latest answer and earlier
questions. A draft that passes the question-format check is saved immediately.
Malformed drafts are repaired at most twice (three total attempts), with model
checks, drafting, and repairs sharing a three-minute budget. Failed generation
does not save a partial turn and can be retried. Cancellation always prevents an
in-flight question from being saved. The format check enforces exactly one
question mark at the end; it does not guarantee relevance, factual accuracy, or
that the sentence contains only one independently answerable request.

## Checks and API

- `GET /api/ollama/health`: `{ running, version }` (200), or `{ running: false, error }` (503).
- `GET /api/ollama/models`: `{ models: string[] }` containing installed local model
  names, or `{ models: [], error }` (503). An empty successful list means no models
  are installed. Use **Refresh models** after installing a model or starting Ollama.
- `POST /api/plan`: same body as `POST /api/conversation`, plus optional
   `previousTopics` (titles to avoid when regenerating) and `forkSummary` (reuses
   the summary returned by an earlier plan for the same fork). Returns
   `{ topics: [{ title, description }], forkSummary }` without saving anything.
- `POST /api/conversation`: `{ subject, model1, model2, persona1?, persona2?, mode?, responseLength?, totalTurns?, devilsAdvocate?, forkedFromId?, topics?, forkSummary? }`.
   `topics` must contain exactly `totalTurns` distinct `{ title, description }`
   entries; omitting it creates an unplanned conversation.
   `devilsAdvocate` is a boolean (default `false`). `forkedFromId` is the ID of an
   existing conversation or `null` (the default); a missing source returns 404.
   Forking generates the summary with `model1` (512-token ceiling per request)
   before responding.
   Personas default to `None` and can be `Student`, `Professor`, `Pastor`,
   `Politician`, or `Historian`. Mode defaults to `discussion` and can be `qa`.
   Response length defaults to `medium` and can be `short`, `medium`, or `long`.
   Q&A rejects `long` with HTTP 400. Existing Q&A conversations saved with `long`
   use Medium instructions and token ceilings for future turns without rewriting history.
   These map to 256, 1024, and 2048 generated-token ceilings. `totalTurns`
   defaults to 5 and accepts integers from 1 to 100. Returns a new conversation
   with no placeholder messages. Agent 1's Q&A questions always use a 256-token ceiling.
- `GET /api/conversation`: returns newest-first conversation summaries with IDs,
   subjects, nullable display titles, status, devil's advocate flags, timestamps,
   and message counts. When
   a title is `null`, the UI displays the subject.
- `PATCH /api/conversation/:id`: `{ title }` renames a completed conversation.
   Titles are trimmed and must contain 1 to 120 characters. The original subject
   remains unchanged. A bodyless PATCH retains the existing generation-cancellation
   behavior.
   `{ resume: true }` releases a generating conversation for retry and fences off
   its abandoned response.
- `POST /api/chat`: `{ conversationId, expectedMessageCount }`. Generates and saves
  exactly one response. The server chooses the next agent, constructs history from
  that agent's perspective, and marks the conversation complete after both agents
  have responded for every turn. Concurrent, stale, or completed requests get 409.
- `POST /api/conversation/:id/summarize`: `{ model? }`. Defaults to the conversation's
   Agent 1 model and returns `{ summary, summaryModel }`, saving both fields without
   changing messages or completion status. Requires a completed, nonempty conversation
   (409 otherwise). Invalid model/body/ID returns 400; missing conversations return
   404. Generation failures leave any previously saved summary unchanged.
- `GET /api/conversation/:id`: retrieves the saved conversation, nullable display
   title, `devilsAdvocate`, nullable `forkedFromId`, nullable `forkSummary`, nullable
   `summary` and `summaryModel`,
   `forks` (`{ id, subject, title, status, createdAt }` for each conversation
   forked from it, oldest first), `topics` (`{ position, title, description }`,
   empty for unplanned conversations), and ordered messages.

If Ollama is unavailable, start it locally. If no models appear, run `ollama list`
and install a chat-capable model. Model, connection, and database errors are
reported separately rather than being replaced with an "Ollama not connected"
message. Requests time out after 5 seconds for connection/model checks and 5
minutes for generation outside Q&A follow-ups. Each Q&A follow-up instead has a
shared three-minute budget for model work; database persistence occurs afterward. A timeout
before any valid question exists returns 504 without advancing the conversation.

## Validation

```sh
npm run lint
npm test
```

`npm test` builds the production app and tests the real HTTP routes against a
controlled local Ollama-compatible fixture and a temporary SQLite database. It
covers default five-turn dialogues, history/agent ordering, persisted completion,
validation, concurrency, retries, empty output, offline health, and model listing.
It also covers follow-up grounding prompts, bounded format repairs, cancellation
during drafting and repairs, and the real three-minute aggregate deadline
(so the suite takes over three minutes).
The fixture does not download models or touch your conversation database.

After pulling schema changes, run `npm run db:setup` and restart running servers so
they load the regenerated Prisma client.
