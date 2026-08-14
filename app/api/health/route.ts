import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', app: 'estima-ia', ts: new Date().toISOString() });
}
