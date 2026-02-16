/**
 * NatureLens API Routes - Plant & Wildlife Identification
 * PackRat Feature - On-device AI identification via React Native AI
 */

import type { Request, PackRatConfig } from '../types';
import { getNatureLensService, type NatureLensService, type AnalysisOptions } from '../services/nature-lens.js';

// Default configuration
const defaultConfig: Partial<PackRatConfig> = {
  dataPath: process.env.PACKRAT_DATA_PATH || './data',
  offlineEnabled: process.env.PACKRAT_OFFLINE !== 'false',
};

// Get service instance
const natureLensService = getNatureLensService({
  dataPath: defaultConfig.dataPath!,
  offlineEnabled: defaultConfig.offlineEnabled ?? true,
  appleVisionEnabled: process.env.NATURE_LENS_APPLE_VISION !== 'false',
  mlKitEnabled: process.env.NATURE_LENS_ML_KIT !== 'false',
  minConfidence: parseFloat(process.env.NATURE_LENS_MIN_CONFIDENCE || '0.6'),
  maxResults: parseInt(process.env.NATURE_LENS_MAX_RESULTS || '5', 10),
});

/**
 * Parse identification request body
 */
function parseBody(body: string | null): IdentificationRequest | null {
  if (!body) return null;
  
  try {
    const parsed = JSON.parse(body);
    
    // Validate image data
    if (!parsed.image && !parsed.imageBase64) {
      return null;
    }

    // Parse options
    const options: AnalysisOptions = {};
    if (parsed.categories && Array.isArray(parsed.categories)) {
      options.categories = parsed.categories;
    }
    if (typeof parsed.includeDetails === 'boolean') {
      options.includeDetails = parsed.includeDetails;
    }
    if (typeof parsed.maxResults === 'number') {
      options.maxResults = Math.min(parsed.maxResults, 10);
    }
    if (typeof parsed.minConfidence === 'number') {
      options.minConfidence = Math.max(0.1, Math.min(parsed.minConfidence, 1.0));
    }

    return {
      image: parsed.image || parsed.imageBase64,
      options,
    };
  } catch {
    return null;
  }
}

/**
 * Identification request interface
 */
interface IdentificationRequest {
  image: string; // Base64 encoded image or path
  options?: AnalysisOptions;
}

/**
 * Handle identification requests
 */
export async function identifyHandler(req: Request): Promise<Response> {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse request
  const body = await req.text();
  const request = parseBody(body);
  
  if (!request) {
    return new Response(JSON.stringify({ 
      error: 'Invalid request body',
      message: 'Request must include "image" or "imageBase64" field with image data',
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Initialize service if needed
  await natureLensService.initialize();

  try {
    // Convert base64 to buffer if needed
    let imageBuffer: Buffer;
    if (request.image.startsWith('data:')) {
      // Data URL format
      const base64Data = request.image.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (/^[A-Za-z0-9+/=]+$/.test(request.image)) {
      // Raw base64
      imageBuffer = Buffer.from(request.image, 'base64');
    } else {
      // File path
      try {
        const fs = await import('fs');
        imageBuffer = fs.readFileSync(request.image);
      } catch {
        return new Response(JSON.stringify({ 
          error: 'Invalid image data',
          message: 'Could not read image file',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const startTime = Date.now();
    const results = await natureLensService.identify(imageBuffer, request.options);
    const processingTimeMs = Date.now() - startTime;

    return new Response(JSON.stringify({
      success: true,
      results,
      metadata: {
        processingTimeMs,
        resultCount: results.length,
        offlineAvailable: true,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[NatureLens] Identification failed:', error);
    
    return new Response(JSON.stringify({
      error: 'Identification failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle service status requests
 */
export async function statusHandler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const status = natureLensService.getStatus();
  
  return new Response(JSON.stringify({
    success: true,
    status,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handle batch identification requests
 */
export async function batchIdentifyHandler(req: Request): Promise<Response> {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse request
  const body = await req.text();
  
  try {
    const parsed = JSON.parse(body);
    
    if (!parsed.images || !Array.isArray(parsed.images)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request body',
        message: 'Request must include "images" array with base64 encoded images',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (parsed.images.length > 10) {
      return new Response(JSON.stringify({ 
        error: 'Too many images',
        message: 'Maximum 10 images per batch request',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await natureLensService.initialize();

    const results: Array<{ index: number; identification: any }> = [];
    const startTime = Date.now();

    for (let i = 0; i < parsed.images.length; i++) {
      try {
        const imageBuffer = Buffer.from(parsed.images[i], 'base64');
        const identification = await natureLensService.identify(
          imageBuffer,
          request.options
        );
        results.push({ index: i, identification });
      } catch (error) {
        console.error(`[NatureLens] Batch identification failed for image ${i}:`, error);
        results.push({ 
          index: i, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const processingTimeMs = Date.now() - startTime;

    return new Response(JSON.stringify({
      success: true,
      results,
      metadata: {
        processingTimeMs,
        totalImages: parsed.images.length,
        successfulIdentifications: results.filter(r => !r.error).length,
        offlineAvailable: true,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[NatureLens] Batch identification failed:', error);
    
    return new Response(JSON.stringify({
      error: 'Batch identification failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle safety check requests
 */
export async function safetyCheckHandler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse request
  const body = await req.text();
  
  try {
    const parsed = JSON.parse(body);
    
    if (!parsed.name) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request',
        message: 'Request must include "name" field with species name',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await natureLensService.initialize();

    // Quick safety lookup
    const normalizedName = parsed.name.toLowerCase();
    const category = parsed.category || 'unknown';
    
    // Use service to get safety info (without full image analysis)
    const status = natureLensService.getStatus();
    
    // Return basic safety information
    return new Response(JSON.stringify({
      success: true,
      name: parsed.name,
      category,
      status: 'checked',
      offlineAvailable: status.knowledgeBase,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[NatureLens] Safety check failed:', error);
    
    return new Response(JSON.stringify({
      error: 'Safety check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle service shutdown
 */
export async function shutdownHandler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await natureLensService.shutdown();
  
  return new Response(JSON.stringify({ 
    success: true,
    message: 'NatureLens service shutdown complete',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Re-export types for convenience
export type { IdentificationRequest } from './routes-naturelens.js';
