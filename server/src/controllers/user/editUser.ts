import { publicProcedure } from '../../trpc';
import * as validator from '../../middleware/validators/index';
import { User } from '../../drizzle/methods/User';
import {validateEmail, validateUsername, validatePassword, hashPassword} from '../../utils/user'
import bcrypt from 'bcryptjs';

/**
 * Edits a user.
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.userId - The ID of the user to edit.
 * @param {Object} res - The response object.
 * @return {Promise} A promise that resolves to the edited user.
 */
// export const editUser = async (req, res, next) => {
//   try {
//     const { userId } = req.body;

//     const editedUser = await prisma.user.update({
//       where: {
//         id: userId,
//       },
//       data: req.body,
//       select: {
//         favorites: true,
//       },
//     });

//     res.locals.data = editedUser;
//     responseHandler(res);
//   } catch (error) {
//     next(UnableToEditUserError);
//   }
// };

export function editUserRoute() {
  return publicProcedure.input(validator.editUser).mutation(async (opts) => {
    const { id, name, email, code, role, username, profileImage, preferredWeather, preferredWeight} = opts.input;
    let {password} = opts.input
    const { env }: any = opts.ctx;
    const JWT_SECRET = env.JWT_SECRET;
    const userClass = new User();
    if (password) {
      const validatedPassword = validatePassword(password)
      password = await hashPassword(JWT_SECRET, validatedPassword);
    }
    const data = {
      id,
      ...(name && {name}),
      ...(password && {password}),
      ...(email && {email: validateEmail(email)}),
      ...(code && { code }),
      ...(role && { role }),
      ...(username && { username: validateUsername(username) }), 
      ...(profileImage && { profileImage }),
      ...(preferredWeather && { preferredWeather }),
      ...(preferredWeight && { preferredWeight }),
    };
    const editedUser = await userClass.update(data);
    return editedUser;
  });
}
