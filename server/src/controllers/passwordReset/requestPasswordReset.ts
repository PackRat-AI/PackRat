import jwt from 'jsonwebtoken';

import { prisma } from '../../prisma';
import {
  STMP_EMAIL,
  CLIENT_URL,
  JWT_SECRET,
  SEND_GRID_API_KEY,
} from '../../config';

import sgMail from '@sendgrid/mail';
import { responseHandler } from '../../helpers/responseHandler';
import { publicProcedure } from '../../trpc';
import * as validator from '../../middleware/validators/index';
import { z } from 'zod';
sgMail.setApiKey(SEND_GRID_API_KEY);

// Generate a password reset token that includes the user's email address
const generatePasswordResetToken = (email) => {
  const payload = { email };
  const secret = JWT_SECRET;
  const expiresIn = '1h';
  return jwt.sign(payload, secret, { expiresIn });
};

const sendPasswordResetEmail = async (email, resetUrl) => {
  const mailOptions = {
    to: email,
    from: {
      email: STMP_EMAIL,
      name: 'PackRat Support',
    },
    subject: 'Password Reset',
    // text: `Click the link below to reset your password:\n\n${resetUrl}\n\nIf you did not request to reset your password, please ignore this email.`,
    html: `
        <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">
          <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 16px;">Password Reset</h2>
          <p style="margin-bottom: 16px;">Click the link below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 8px 16px; background-color: #0070f3; color: #fff; text-decoration: none; border-radius: 4px; margin-bottom: 16px;">Reset Password</a>
          <p>If you did not request to reset your password, please ignore this email.</p>
        </div>
      `,
  };

  try {
    await sgMail.send(mailOptions);
    console.log('Password reset email sent successfully');
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
};

/**
 * Sends a password reset email to the user and updates the user's password reset token.
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @return {Object} The HTTP response object with a success message or an error message.
 */
export const requestPasswordResetEmailAndToken = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (!user) {
      return res
        .status(400)
        .send({ error: 'No user found with this email address' });
    }

    const resetToken = generatePasswordResetToken(email);
    const resetTokenExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: {
        email: email,
      },
      data: {
        passwordResetToken: resetToken,
        passwordResetTokenExpiration: resetTokenExpiration,
      },
    });
    const resetUrl = `${CLIENT_URL}/password-reset?token=${resetToken}`;
    sendPasswordResetEmail(email, resetUrl);

    res.locals.data = { message: 'Password reset email sent successfully' };
    responseHandler(res);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return res.status(500).send({ error: 'Internal server error' });
  }
};

export function requestPasswordResetEmailAndTokenRoute() {
  return publicProcedure
    .input(z.object({ email: z.string() }))
    .mutation(async (opts) => {
      const { email } = opts.input;
      const user = await prisma.user.findUnique({
        where: {
          email: email,
        },
      });

      if (!user) {
        return { error: 'No user found with this email address' };
      }
      const resetToken = generatePasswordResetToken(email);
      const resetTokenExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: {
          email: email,
        },
        data: {
          passwordResetToken: resetToken,
          passwordResetTokenExpiration: resetTokenExpiration,
        },
      });
      const resetUrl = `${CLIENT_URL}/password-reset?token=${resetToken}`;
      sendPasswordResetEmail(email, resetUrl);
      return { message: 'Password reset email sent successfully' };
    });
}

// Send the password reset email with the reset token included in the URL
// const sendPasswordResetEmail = async (email, resetUrl) => {
//     const transporter = nodemailer.createTransport({
//         service: 'outlook',
//         auth: {
//             user: STMP_EMAIL,
//             pass: STMP_PASSWORD,
//         },
//     });

//     const mailOptions = {
//         from: `"PackRat Support" <${STMP_EMAIL}>"`,
//         to: email,
//         subject: 'Password Reset',
//         text: `Click the link below to reset your password:\n\n${resetUrl}\n\nIf you did not request to reset your password, please ignore this email.`,
//     };

//     try {
//         await transporter.sendMail(mailOptions);
//         console.log('Password reset email sent successfully');
//     } catch (error) {
//         console.error('Error sending password reset email:', error);
//     }
// };
