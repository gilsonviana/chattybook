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
   optionally enable Q&A mode and choose a response length, then select **Start
   dialogue**. Personas can be set independently to None, Student, Professor,
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
   **Review model** selects an installed local model to assess follow-ups; its
   default follows Agent 1's model. Openers, Agent 2 replies, and discussion-mode
   messages are not reviewed.
   **Devil's advocate** makes Agent 1 skeptical: in discussion mode it questions
   Agent 2's claims and tries to refute them; in Q&A mode its questions challenge a
   specific claim or assumption in Agent 2's latest answer (still one question per
   turn). Agent 2's instructions are unchanged.

Each answer appears when generation and any follow-up review finish. The first request can
take longer while Ollama loads model weights. Existing answers stay visible while
the next agent thinks. Conversations and completion status are saved in SQLite.
Each conversation has its own `/conversation/{id}` URL, and the home page lists
previous conversations so they can be reopened. Opening an unfinished saved chat
restores its messages without starting generation; select **Retry / continue
dialogue** to resume it.
**Fork** (on the conversation page or in a history item's menu) copies a
conversation's subject and settings into the setup form so you can change models
or settings before starting. When you start, the new Agent 1 model summarizes the
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
**Export to PDF** on the conversation page opens the browser's print dialog with a
print layout of the dialogue; choose **Save as PDF** as the destination.
If generation fails, the actual error is displayed; **Retry / continue dialogue**
reloads persisted messages and resumes without adding a fake or empty answer.

Q&A follow-ups are drafted, reviewed, and repaired at most twice if needed (three
total candidates). Generation stops as soon as the reviewer returns `ok`. The
review checks connection to the latest answer, conversational progress, and a
single independently answerable question. Repetition means requesting information
already supplied in Agent 2's answers; returning to the same topic to ask for a
new detail is allowed. Drafting, model checks, review, and
repair share a three-minute budget. Review adds local inference calls and can take
longer when switching models.

Review is advisory: if the final question is rejected, review fails, or the budget
expires, the latest question that passes the one-question format check is saved.
Rejected or unverified follow-ups show a **Quality warning** that remains after
reopening the conversation. Rejected warnings include the recorded reason and,
when supplied by the reviewer, a one-line explanation capped at 240 characters.
Explanations are displayed as plain text and describe the reviewer's judgment,
not proof that a question is bad. Unverified warnings distinguish a timeout from
reviewer failure. Historical warnings without details say none were recorded;
existing messages are not re-reviewed. If no valid question exists, generation fails and can
be retried. Cancellation always prevents an in-flight question from being saved.
The format check enforces one terminal question mark; semantic review can detect
compound requests but does not guarantee relevance or factual accuracy.

## Checks and API

- `GET /api/ollama/health`: `{ running, version }` (200), or `{ running: false, error }` (503).
- `GET /api/ollama/models`: `{ models: string[] }` containing installed local model
  names, or `{ models: [], error }` (503). An empty successful list means no models
  are installed. Use **Refresh models** after installing a model or starting Ollama.
- `POST /api/conversation`: `{ subject, model1, model2, reviewerModel?, persona1?, persona2?, mode?, responseLength?, totalTurns?, devilsAdvocate?, forkedFromId? }`.
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
   with no placeholder messages. `reviewerModel` is an installed local model name
   or `null` (the default, using Agent 1's model). Review has a separate 256-token
   ceiling. Existing conversations use the same default without rewriting history.
- `GET /api/conversation`: returns newest-first conversation summaries with IDs,
   subjects, nullable display titles, status, devil's advocate flags, timestamps,
   and message counts. When
   a title is `null`, the UI displays the subject.
- `PATCH /api/conversation/:id`: `{ title }` renames a completed conversation.
   Titles are trimmed and must contain 1 to 120 characters. The original subject
   remains unchanged. A bodyless PATCH retains the existing generation-cancellation
   behavior.
- `POST /api/chat`: `{ conversationId, expectedMessageCount }`. Generates and saves
  exactly one response. The server chooses the next agent, constructs history from
  that agent's perspective, and marks the conversation complete after both agents
  have responded for every turn. Concurrent, stale, or completed requests get 409.
- `GET /api/conversation/:id`: retrieves the saved conversation, nullable display
   title, `devilsAdvocate`, nullable `forkedFromId`, nullable `forkSummary`,
   `forks` (`{ id, subject, title, status, createdAt }` for each conversation
   forked from it, oldest first), and ordered messages.
   Messages include `reviewStatus`: `accepted`, `rejected`, `unchecked`, or `null`
   when review does not apply or the message predates review support.
   Nullable `reviewReason` is `ok`, `disconnected`, `repetitive`, `compound`, or
   `not_question_only` for reviewed questions, or `reviewer_error` / `timeout`
   when verification could not finish. Nullable `reviewExplanation` contains the
   reviewer's short explanation, normalized to one line and capped at 240 characters.

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

Run the optional labeled reviewer evaluation against an installed local model:

```sh
npm run reviewer:eval -- gemma2:2b
npm run reviewer:eval -- qwen2.5:latest --json reports/qwen.json --min-score 80
```

The evaluator uses the production reviewer prompt, schema, and verdict parser on
balanced accept and retry cases covering every review reason. Each case is
scored on four rules, combined into a weighted 0-100 score:

| Rule | Weight | Passes when |
| --- | --- | --- |
| warning | 40 | A quality warning is shown exactly when expected (invalid output counts as an unverified warning, as in the app) |
| reason | 30 | The reason label matches |
| schema | 15 | The output is valid schema JSON with a consistent verdict and reason |
| explanation | 15 | A rejection includes a one-line explanation of at most 240 characters |

It also reports quality-warning precision, recall, and F1, and reason accuracy
per expected label. `--json <path>` saves the full report, including raw outputs
and a SHA-256 of the reviewer prompt, so runs can be compared across prompt
revisions. The command exits nonzero when the score is below `--min-score`
(default 100). It does not download models and is not part of `npm test`; the
scoring logic itself is unit-tested there.

`npm test` builds the production app and tests the real HTTP routes against a
controlled local Ollama-compatible fixture and a temporary SQLite database. It
covers default five-turn dialogues, history/agent ordering, persisted completion,
validation, concurrency, retries, empty output, offline health, and model listing.
It also covers reviewer selection, follow-up grounding prompts, bounded repairs,
advisory fallback, strict verdict parsing, candidate-specific reasons/explanations,
feedback normalization and persistence, cancellation at every review stage,
and the real three-minute aggregate deadline (so the suite takes over three minutes).
The fixture does not download models or touch your conversation database.
