import { protectedProcedure } from '../../trpc';
import { findUserAndUpdate } from '../../services/user/user.service';
import * as validator from '@packrat/validations';
import { hashPassword } from '../../utils/user';
import { type Context } from 'hono';
import { User } from '../../drizzle/methods/User';

export const updatePassword = async (c: Context) => {
  try {
    const { email, password } = await c.req.json();
    const JWT_SECRET = c.env.JWT_SECRET;
    const hashedPassword = await hashPassword(JWT_SECRET, password);
    const currentUser = await findUserAndUpdate(
      email,
      hashedPassword,
      'password',
    );
    return c.json({ currentUser }, 200);
  } catch (error) {
    return c.json({ error: `Email Doesnt Exist: ${error.message}` }, 404);
  }
};

export function updatePasswordRoute() {
  return protectedProcedure
    .input(validator.updatePassword)
    .mutation(async (opts) => {
      const { email, password } = opts.input;
      const { env }: any = opts.ctx;
      const JWT_SECRET = env.JWT_SECRET;
      const userClass = new User();
      const user = await userClass.findByCredentials(email, password);
      if (!user) {
        throw new Error('Password is not correct');
      }
      const hashedPassword = await hashPassword(JWT_SECRET, password);
      const currentUser = await findUserAndUpdate(
        email,
        hashedPassword,
        'password',
      );
      return currentUser;
    });
}
