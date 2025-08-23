import { searchCatalogForGuides } from 'guides-app/lib/catalogSearchClient';
import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

// Ensure this only works in development
const isDevelopment = process.env.NODE_ENV === 'development';

export async function GET(request: Request) {
  // Block in production
  if (!isDevelopment) {
    return NextResponse.json(
      {
        success: false,
        error: 'This endpoint is only available in development mode',
      },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = Number(searchParams.get('limit')) || 10;
    const category = searchParams.get('category') || undefined;
    const minRating = Number(searchParams.get('minRating')) || undefined;

    if (!query) {
      return NextResponse.json({ success: false, error: 'Query parameter "q" is required' }, { status: 400 });
    }

    // Call the catalog search API
    const result = await searchCatalogForGuides(query, {
      limit,
      category,
      minRating,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in catalog search dev endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}