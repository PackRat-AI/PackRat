import { guideEnv } from '@packrat/env/next';
import { GeneratePostRequestSchema } from 'guides-app/lib/schemas/dev';
import { generatePost } from 'guides-app/scripts/generate-content';
import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

// Ensure this only works in development
const isDevelopment = guideEnv.NODE_ENV === 'development';

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
    const parsed = GeneratePostRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }
    const requestData = parsed.data;

    // Generate the post
    const filePath = await generatePost(requestData);

    if (!filePath) {
      throw new Error('Failed to generate post');
    }

    // Read the generated file to return its content
    const fs = require('fs');
    const content = fs.readFileSync(filePath, 'utf8');

    return NextResponse.json({
      success: true,
      filePath,
      content,
    });
  } catch (error) {
    console.error('Error generating post:', error);
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
