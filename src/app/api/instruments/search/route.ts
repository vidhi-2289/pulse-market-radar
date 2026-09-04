import { NextRequest, NextResponse } from 'next/server';
import { InstrumentSearchQuerySchema } from '@/server/validation/schemas';
import { searchInstruments } from '@/server/instruments';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawQ = searchParams.get('q');

  if (!rawQ || rawQ.trim().length < 2) {
    return NextResponse.json({
      query: rawQ || '',
      results: [],
      count: 0,
      source: 'LOCAL_CATALOG',
    });
  }

  try {
    const { q } = InstrumentSearchQuerySchema.parse({ q: rawQ });
    const data = await searchInstruments(q, 8);

    return NextResponse.json(data);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid search query' },
        { status: 400 }
      );
    }

    console.error('[Pulse API] Instrument search error:', error);
    return NextResponse.json(
      { error: 'Failed to search instruments' },
      { status: 500 }
    );
  }
}
