import { generatePost } from "guides-app/scripts/generate-content";
import { NextResponse } from "next/server";

export const dynamic = "force-static";

// Ensure this only works in development
const isDevelopment = process.env.NODE_ENV === "development";

export async function POST(request: Request) {
  // Block in production
  if (!isDevelopment) {
    return NextResponse.json(
      {
        success: false,
        error: "This endpoint is only available in development mode",
      },
      { status: 403 }
    );
  }

  try {
    const requestData = await request.json();

    // Validate request
    if (!requestData.title) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 }
      );
    }

    if (
      !requestData.categories ||
      !Array.isArray(requestData.categories) ||
      requestData.categories.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: "At least one category is required" },
        { status: 400 }
      );
    }

    // Generate the post
    const filePath = await generatePost(requestData);

    if (!filePath) {
      throw new Error("Failed to generate post");
    }

    // Read the generated file to return its content
    const fs = require("fs");
    const content = fs.readFileSync(filePath, "utf8");

    return NextResponse.json({
      success: true,
      filePath,
      content,
    });
  } catch (error) {
    console.error("Error generating post:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
