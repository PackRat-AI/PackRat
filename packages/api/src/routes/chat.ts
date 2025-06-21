import { getWeatherData } from "@/services/getWeatherData";
import { Env } from "@/types/env";
import {
  authenticateRequest,
  unauthorizedResponse,
} from "@/utils/api-middleware";
import { getItemDetails, getPackDetails } from "@/utils/DbUtils";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { env } from "hono/adapter";
import { reportedContent } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createDb } from '@/db';

const chatRoutes = new OpenAPIHono();

const chatRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.any(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Chat response',
    },
  },
});

chatRoutes.openapi(chatRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { messages, contextType, itemId, packId, userId, location } =
      await c.req.json();

    // Only get weather data if location is defined
    const weatherData = location ? await getWeatherData(location, c) : null;

    // Build context based on what was passed
    let systemPrompt = '';

    if (contextType === 'item' && itemId) {
      const item = await getItemDetails({ itemId, c });
      if (item) {
        // Determine if it's a pack item or catalog item
        const isPackItem = 'packId' in item;

        systemPrompt = `
          You are PackRat AI, a helpful assistant for hikers and outdoor enthusiasts.
          You're currently helping with an item named: ${item.name} (${item.category || 'Uncategorized'}).
          
          Item details:
          - Weight: ${isPackItem ? `${item.weight} ${item.weightUnit}` : `${item.defaultWeight || 'Unknown'} ${item.defaultWeightUnit || 'oz'}`}
          ${item.description ? `- Description: ${item.description}` : ''}
          ${isPackItem && item.notes ? `- Notes: ${item.notes}` : ''}
          ${isPackItem ? `- Consumable: ${item.consumable ? 'Yes' : 'No'}` : ''}
          ${isPackItem ? `- Worn: ${item.worn ? 'Yes' : 'No'}` : ''}
          ${!isPackItem && item.brand ? `- Brand: ${item.brand}` : ''}
          ${!isPackItem && item.model ? `- Model: ${item.model}` : ''}
          
          ${
            weatherData
              ? `Current weather in ${weatherData.location}: ${weatherData.temperature}°F, ${weatherData.conditions}, 
          ${weatherData.humidity}% humidity, wind ${weatherData.windSpeed} mph.`
              : ''
          }
          
          Provide friendly, concise advice about this item. You can suggest alternatives, 
          maintenance tips, or ways to use it effectively${weatherData ? ' based on the current weather conditions' : ''}.
          Keep your responses brief and focused on ultralight hiking principles when appropriate.
        `;
      }
    } else if (contextType === 'pack' && packId) {
      const pack = await getPackDetails({ packId, c });
      if (pack) {
        // Calculate total weight
        const totalWeight = pack.items.reduce((sum, item) => {
          // Skip worn items in base weight calculation
          if (item.worn) return sum;
          return sum + item.weight * item.quantity;
        }, 0);

        // Get unique categories
        const categories = Array.from(
          new Set(pack.items.map((item) => item.category || 'Uncategorized'))
        );

        systemPrompt = `
          You are PackRat AI, a helpful assistant for hikers and outdoor enthusiasts.
          You're currently helping with a pack named: ${pack.name} (${pack.category || 'Uncategorized'}).
          
          Pack details:
          - Items: ${JSON.stringify(pack.items)}
          - Base Weight: ${totalWeight.toFixed(2)} ${pack.items[0]?.weightUnit || 'oz'}
          - Categories: ${categories.join(', ')}
          ${pack.description ? `- Description: ${pack.description}` : ''}
          ${pack.tags?.length ? `- Tags: ${pack.tags.join(', ')}` : ''}
          
          ${
            weatherData
              ? `Current weather in ${weatherData.location}: ${weatherData.temperature}°F, ${weatherData.conditions}, 
          ${weatherData.humidity}% humidity, wind ${weatherData.windSpeed} mph.`
              : ''
          }
          
          Provide friendly, concise advice about this pack. You can suggest items that might be missing,
          ways to reduce weight, or improvements based on the pack's purpose${weatherData ? ' and current weather conditions' : ''}.
          Keep your responses brief and focused on ultralight hiking principles when appropriate.
        `;
      }
    } else {
      // General outdoor conversation
      systemPrompt = `
        You are PackRat AI, a helpful assistant for hikers and outdoor enthusiasts.
        You provide advice on what items users should take in their packs based on their needs,
        ${weatherData ? 'weather conditions, and' : 'and'} ultralight hiking best practices.
        
        ${
          weatherData
            ? `Current weather in ${weatherData.location}: ${weatherData.temperature}°F, ${weatherData.conditions}, 
        ${weatherData.humidity}% humidity, wind ${weatherData.windSpeed} mph.`
            : ''
        }
        
        Provide friendly, concise advice. Suggest items based on the user's questions${weatherData ? ' and current weather' : ''}.
        For ultralight hikers, focus on multi-purpose items and weight savings.
        For beginners, emphasize safety and comfort.
        Keep your responses brief and to the point.
      `;
    }

    const { OPENAI_API_KEY } = env<Env>(c);

    // Create a custom OpenAI provider with your API key
    const customOpenAI = createOpenAI({
      apiKey: OPENAI_API_KEY,
    });

    // Stream the AI response
    const result = streamText({
      model: customOpenAI('gpt-4o'),
      system: systemPrompt,
      messages,
      maxTokens: 1000,
      temperature: 0.7, // Add some creativity but not too much
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('AI Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process AI chat request' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

chatRoutes.post('/reports', async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);

  try {
    const { messageId, userQuery, aiResponse, reason, userComment } =
      await c.req.json();

    // Insert the reported content into the database
    await db.insert(reportedContent).values({
      userId: auth.userId,
      userQuery,
      aiResponse,
      reason,
      userComment,
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Report content API error:', error);
    return c.json({ error: 'Failed to report content' }, 500);
  }
});

// Get all reported content (admin only) - separate endpoint
chatRoutes.get('/reports', async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);

  // Check if user is admin
  const isAdmin = await checkIfUserIsAdmin(auth.userId, c);
  if (!isAdmin) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  try {
    const reportedItems = await db.query.reportedContent.findMany({
      orderBy: (reportedContent, { desc }) => [desc(reportedContent.createdAt)],
      with: {
        user: true,
      },
    });

    return c.json({ reportedItems });
  } catch (error) {
    console.error('Get reported content API error:', error);
    return c.json({ error: 'Failed to get reported content' }, 500);
  }
});

// Update reported content status (admin only)
chatRoutes.patch('/reports/:id', async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);

  // Check if user is admin
  const isAdmin = await checkIfUserIsAdmin(auth.userId, c);
  if (!isAdmin) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  try {
    const id = Number.parseInt(c.req.param('id'));
    const { status } = await c.req.json();

    await db
      .update(reportedContent)
      .set({
        status,
        reviewed: true,
        reviewedBy: auth.userId,
        reviewedAt: new Date(),
      })
      .where(eq(reportedContent.id, id));

    return c.json({ success: true });
  } catch (error) {
    console.error('Update reported content API error:', error);
    return c.json({ error: 'Failed to update reported content' }, 500);
  }
});

// Helper function to check if a user is an admin
async function checkIfUserIsAdmin(userId: number, c: any) {
  const db = createDb(c);

  try {
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
      columns: {
        role: true,
      },
    });

    return user?.role === 'ADMIN';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

export { chatRoutes };
