import { NextResponse } from 'next/server';
import type { RequestStatus } from './types';

type ErrorKind =
  | 'unauthenticated'
  | 'validation'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'expired'
  | 'server';

const STATUS: Record<ErrorKind, number> = {
  unauthenticated: 401,
  validation: 400,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  expired: 410,
  server: 500,
};

export function errorJson(
  kind: ErrorKind,
  extra?: { issues?: Array<{ path: string; message: string }>; status?: RequestStatus },
) {
  return NextResponse.json({ error: kind, ...(extra ?? {}) }, { status: STATUS[kind] });
}

export function okJson<T>(body: T, status = 200) {
  return NextResponse.json(body, { status });
}
