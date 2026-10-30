import { NextResponse } from 'next/server'

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new ApiError('Request body must be valid JSON.', 400)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('Request body must be a JSON object.', 400)
  }
  return body as Record<string, unknown>
}

export function errorResponse(error: unknown) {
  console.error(error)
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'An unexpected error occurred.' },
    { status: error instanceof ApiError ? error.status : 500 },
  )
}
