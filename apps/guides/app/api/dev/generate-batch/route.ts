import { generatePosts } from 'guides-app/scripts/generate-content';
import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

// Ensure this only works in development
const isDevelopment = process.env.NODE_ENV === 'development';

export async function POST(request: Request) {
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
    const requestData = await request.json();

    // Validate request
    const count = Number.parseInt(requestData.count) || 5;

    if (count <= 0 || count > 20) {
      return NextResponse.json(
        { success: false, error: 'Count must be between 1 and 20' },
        { status: 400 },
      );
    }

    // Generate the posts
    const filePaths = await generatePosts(count, requestData.categories);

    if (!filePaths.length) {
      throw new Error('Failed to generate posts');
    }

    return NextResponse.json({
      success: true,
      filePaths,
      count: filePaths.length,
    });
  } catch (error) {
    console.error('Error generating batch:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
