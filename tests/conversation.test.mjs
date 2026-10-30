import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

let server
let app
let directory
let base
let output = ''
let mode = 'online'
const calls = []
const localModels = ['first:local', 'second:local']

async function listen(server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return server.address().port
}

async function api(path, body) {
  const response = await fetch(`${base}${path}`, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, data: await response.json() }
}

async function createConversation(extra = {}) {
  return api('/api/conversation', {
    subject: 'How can cities support urban gardens?',
    model1: localModels[0],
    model2: localModels[1],
    ...extra,
  })
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'chattybook-test-'))
  server = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}
    response.setHeader('Content-Type', 'application/json')
    if (mode === 'offline') {
      response.writeHead(503).end(JSON.stringify({ error: 'Ollama is offline' }))
    } else if (request.url === '/api/version') {
      response.end(JSON.stringify({ version: 'test-local' }))
    } else if (request.url === '/api/tags') {
      response.end(JSON.stringify({ models: mode === 'no-models' ? [] : [
        ...localModels.map(name => ({ name })),
        ...(mode === 'cloud-alias' ? [{ name: 'disguised:local' }] : []),
        { name: 'remote:cloud' },
        { name: 'remote-alias', remote_model: 'remote', remote_host: 'https://example.invalid' },
      ] }))
    } else if (request.url === '/api/show') {
      response.end(JSON.stringify(body.model === 'disguised:local'
        ? { remote_model: 'remote', remote_host: 'https://example.invalid' }
        : { capabilities: ['completion'] }))
    } else if (request.url === '/api/chat') {
      calls.push(body)
      await new Promise(resolve => setTimeout(resolve, 50))
      response.end(JSON.stringify({
        message: { role: 'assistant', content: mode === 'empty' ? '' : `A real fixture answer from ${body.model}, response ${calls.length}.` },
        done: true,
      }))
    } else {
      response.writeHead(404).end(JSON.stringify({ error: 'Unknown fixture endpoint' }))
    }
  })
  const ollamaPort = await listen(server)
  const reservation = createServer()
  const appPort = await listen(reservation)
  await new Promise(resolve => reservation.close(resolve))
  base = `http://127.0.0.1:${appPort}`
  const env = {
    ...process.env,
    DATABASE_URL: `file:${join(directory, 'test.sqlite')}`,
    OLLAMA_BASE_URL: `http://127.0.0.1:${ollamaPort}`,
  }
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env, stdio: 'pipe' })
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(appPort)], { env })
  app.stdout.on('data', chunk => { output += chunk })
  app.stderr.on('data', chunk => { output += chunk })
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(`${base}/api/ollama/health`)).ok) return
    } catch (error) {
      if (app.exitCode !== null) throw new Error(`App exited: ${output}`, { cause: error })
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`App failed to start: ${output}`)
})

after(async () => {
  if (app && app.exitCode === null) {
    const exited = once(app, 'exit')
    app.kill('SIGTERM')
    await exited
  }
  if (server) await new Promise(resolve => server.close(resolve))
  if (directory) await rm(directory, { recursive: true, force: true })
})

test('health and model checks expose only installed local models and explicit failures', async () => {
  assert.deepEqual(await api('/api/ollama/health'), {
    status: 200, data: { running: true, version: 'test-local' },
  })
  assert.deepEqual((await api('/api/ollama/models')).data.models, localModels)
  mode = 'no-models'
  assert.deepEqual(await api('/api/ollama/models'), { status: 200, data: { models: [] } })
  mode = 'offline'
  const health = await api('/api/ollama/health')
  assert.equal(health.status, 503)
  assert.equal(health.data.running, false)
  assert.match(health.data.error, /Ollama/)
  const models = await api('/api/ollama/models')
  assert.equal(models.status, 503)
  assert.deepEqual(models.data.models, [])
  assert.equal((await createConversation()).status, 503)
  mode = 'online'
})

test('default five turns generate ten alternating answers with correct perspectives and persistence', async () => {
  calls.length = 0
  const created = await createConversation()
  assert.equal(created.status, 201)
  assert.equal(created.data.totalTurns, 5)
  assert.deepEqual(created.data.messages, [])
  const id = created.data.id
  for (let index = 0; index < 10; index++) {
    const result = await api('/api/chat', { conversationId: id, expectedMessageCount: index })
    assert.equal(result.status, 200, JSON.stringify(result.data))
    assert.equal(result.data.allMessages.length, index + 1)
    assert.equal(result.data.completed, index === 9)
    const message = result.data.allMessages[index]
    assert.equal(message.speaker, index % 2 === 0 ? 'agent1' : 'agent2')
    assert.equal(message.turnNumber, Math.floor(index / 2) + 1)
    assert.ok(message.content.trim())
    const call = calls[index]
    assert.equal(call.model, localModels[index % 2])
    assert.match(call.messages[0].content, /urban gardens/)
    assert.equal(call.messages.length, index + 2)
    for (let previous = 0; previous < index; previous++) {
      assert.equal(call.messages[previous + 2].role, previous % 2 === index % 2 ? 'assistant' : 'user')
      assert.equal(call.messages[previous + 2].content, result.data.allMessages[previous].content)
    }
  }
  const saved = await api(`/api/conversation/${id}`)
  assert.equal(saved.data.status, 'completed')
  assert.equal(saved.data.messages.length, 10)
  assert.equal((await api('/api/chat', { conversationId: id, expectedMessageCount: 10 })).status, 409)
  assert.equal(calls.length, 10)
})

test('concurrent and stale requests do not create duplicate messages', async () => {
  const { data } = await createConversation({ totalTurns: 1, model2: localModels[0] })
  const body = { conversationId: data.id, expectedMessageCount: 0 }
  const results = await Promise.all([api('/api/chat', body), api('/api/chat', body)])
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
  assert.equal((await api('/api/chat', body)).status, 409)
  assert.equal((await api(`/api/conversation/${data.id}`)).data.messages.length, 1)
  const second = await api('/api/chat', { ...body, expectedMessageCount: 1 })
  assert.equal(second.status, 200)
  assert.equal(second.data.completed, true)
})

test('empty output and Ollama failures persist no fake answer and can be retried', async () => {
  const { data } = await createConversation({ totalTurns: 1 })
  const body = { conversationId: data.id, expectedMessageCount: 0 }
  mode = 'empty'
  const empty = await api('/api/chat', body)
  assert.equal(empty.status, 502)
  assert.match(empty.data.error, /no answer text/)
  let saved = (await api(`/api/conversation/${data.id}`)).data
  assert.deepEqual(saved.messages, [])
  assert.equal(saved.status, 'active')
  mode = 'offline'
  assert.equal((await api('/api/chat', body)).status, 503)
  saved = (await api(`/api/conversation/${data.id}`)).data
  assert.deepEqual(saved.messages, [])
  assert.equal(saved.status, 'active')
  mode = 'online'
  assert.equal((await api('/api/chat', body)).status, 200)
})

test('invalid inputs, missing conversations, and uninstalled/cloud models are rejected', async () => {
  for (const extra of [{ subject: ' ' }, { totalTurns: 0 }, { totalTurns: 2.5 }, { totalTurns: 101 }, { totalTurns: '5' }, { model1: 'not-installed' }, { model1: 'remote:cloud' }, { model1: 'remote-alias' }]) {
    assert.equal((await createConversation(extra)).status, 400, JSON.stringify(extra))
  }
  assert.equal((await api('/api/chat', { conversationId: -1, expectedMessageCount: 0 })).status, 400)
  assert.equal((await api('/api/chat', { conversationId: 1 })).status, 400)
  assert.equal((await api('/api/chat', { conversationId: 999999, expectedMessageCount: 0 })).status, 404)
  assert.equal((await api('/api/conversation/invalid')).status, 400)
  assert.equal((await api('/api/conversation/999999')).status, 404)
  mode = 'cloud-alias'
  const cloudAlias = await createConversation({ model1: 'disguised:local' })
  assert.equal(cloudAlias.status, 400)
  assert.match(cloudAlias.data.error, /Cloud models are not supported/)
  mode = 'online'
  const malformed = await fetch(`${base}/api/conversation`, { method: 'POST', body: '{invalid' })
  assert.equal(malformed.status, 400)
})
