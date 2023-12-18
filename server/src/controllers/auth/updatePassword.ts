import { publicProcedure } from '../../trpc';
import { UnableTouUpdatePasswordError } from '../../helpers/errors';
import { responseHandler } from '../../helpers/responseHandler';
import { findUserAndUpdate } from '../../services/user/user.service';
import bcrypt from 'bcryptjs';
import { JWT_SECRET } from '../../config';
import * as validator from '../../middleware/validators/index';
// import { prisma } from '../../prisma';

/**
 * Updates the password for a user.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @return {Promise<void>} - A promise that resolves to nothing.
 */
// export const updatePassword = async (req, res, next) => {
//   try {
//     let { email, oldPassword, newPassword } = req.body;

//     const user = await prisma.user.findFirst({
//       where: {
//         email,
//       },
//     });

//     if (!user) throw new Error('Unable to verify');

//     const isMatch = await bcrypt.compare(oldPassword, user.password);

//     if (!isMatch) throw new Error('Incorrect password');

//     const salt = await bcrypt.genSalt(parseInt(JWT_SECRET));

//     newPassword = await bcrypt.hash(newPassword, salt);

//     const val = await findUserAndUpdate(email, newPassword, 'password');

//     if (val) {
//       responseHandler(res);
//     } else {
//       next(UnableTouUpdatePasswordError);
//     }
//   } catch (error) {
//     next(UnableTouUpdatePasswordError);
//   }
// };

export function updatePasswordRoute() {
  return publicProcedure
    .input(validator.updatePassword)
    .mutation(async (opts) => {
      const { email, password } = opts.input;
      const { prisma }: any = opts.ctx;
      const val = await findUserAndUpdate(prisma, email, password, 'password');
      return val;
    });
}
