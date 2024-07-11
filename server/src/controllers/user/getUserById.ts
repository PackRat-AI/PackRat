import { publicProcedure } from '../../trpc';
import { getUserByIdService } from '../../services/user/getUserByIdService';
import * as validator from '@packrat/validations';
import { responseHandler } from '../../helpers/responseHandler';
import { UserNotFoundError } from '../../helpers/errors';
import { Context, Next } from 'hono';
/**
 * Retrieves a user by their ID from the database and returns the user object as a JSON response.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @return {Object} The user object as a JSON response.
 */
export const getUserById = async (c: Context, next: Next) => {
  try {
    console.log('DONEDONEDONE')
    const { userId } = c.req.params;

    const user = await getUserByIdService(userId);

    c.res.locals.data = user;
    responseHandler(c.res);
  } catch (error) {
    next(UserNotFoundError);
  }
};

export function getUserByIdRoute() {
  return publicProcedure.input(validator.getUserById).query(async (opts) => {
    const { userId } = opts.input;
    return await getUserByIdService(userId);
  });
}
