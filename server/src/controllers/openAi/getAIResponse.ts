import { publicProcedure } from '../../trpc';
import { GetResponseFromAIError } from '../../helpers/errors';
import { responseHandler } from '../../helpers/responseHandler';
import { z } from 'zod';
import { getAIResponseService } from './langchain';

/**
 * Retrieves an AI response based on user input and conversation history.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @return {Object} The AI response and updated conversation object.
 */
export const getAIResponse = async (req, res, next) => {
  try {
    const { userId, conversationId, userInput } = req.body;

    const result = await getAIResponseService(
      userId,
      conversationId,
      userInput,
    );

    res.locals.data = result;
    responseHandler(res);
  } catch (error) {
    next(GetResponseFromAIError);
  }
};

export function getAIResponseRoute() {
  return publicProcedure
    .input(
      z.object({
        userId: z.string(),
        conversationId: z.string(),
        userInput: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const { userId, conversationId, userInput } = opts.input;
      return getAIResponseService(userId, conversationId, userInput);
    });
}
