import bcrypt from 'bcrypt';
import { sendWelcomeEmail, resetEmail } from '../../utils/accountEmail';
import { JWT_SECRET } from '../../config';
import { publicProcedure } from '../../trpc';
import * as validator from '../../middleware/validators/index';
import { prisma } from '../../prisma';
import { User } from '../../prisma/methods';
import { Request, Response } from 'express';

export const userSignup = async (req: Request, res: Response) => {
  const { email } = req.body;
  console.log(`the request body received is ${JSON.stringify(req.body)}`);
  await prisma.user.alreadyLogin(email);
  const salt = await bcrypt.genSalt(parseInt(JWT_SECRET));
  req.body.password = await bcrypt.hash(req.body.password, salt);

  const newUser = await prisma.user.create({
    data: req.body,
  });
  const userWithMethods = User(newUser);
  await userWithMethods.generateAuthToken();
  sendWelcomeEmail(newUser.email, newUser.name);
  res.status(201).send({ user: newUser });
};

export function signUpRoute() {
  return publicProcedure.input(validator.userSignUp).mutation(async (opts) => {
    let { email, password, name, username } = opts.input;
    console.log(opts.input);
    await prisma.user.alreadyLogin(email);
    const salt = await bcrypt.genSalt(parseInt(JWT_SECRET));
    password = await bcrypt.hash(password, salt);
    const user = await prisma.user.create({
      data: {
        email,
        password,
        name,
        username,
      },
    });
    const userWithMethods = User(user);
    await userWithMethods.generateAuthToken();
    sendWelcomeEmail(user.email, user.name);
    return user;
  });
}
