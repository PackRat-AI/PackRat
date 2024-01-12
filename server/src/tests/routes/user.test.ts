import { generateMock } from '@anatine/zod-mock';
import mongoose from 'mongoose';
import { userSignUp } from '../../middleware/validators';
import { createCaller } from '../../routes/trpcRouter';

beforeEach(async () => {
  process.env.NODE_ENV = 'test';
  await mongoose.connect(process.env.MONGODB_URI ?? '');
});

afterEach(async () => {
  await mongoose.disconnect();
});

const caller = createCaller({});

let user: any = generateMock(userSignUp);

//* Wrapped each test suit with describe to execute them sequentially
describe('User routes', () => {
  describe('User Sing Up', () => {
    test('User Sing Up', async () => {
      const currentUser = await caller.signUp(user);

      // SendGrid is not working in test environment, but otherwise this test passes. Short term solution is to comment out the sendWelcomeEmail function in userSignUp.ts.

      expect(currentUser.id).toBeDefined();
      expect(currentUser.password).toBeDefined();
      expect(currentUser.role).toBeDefined();
      expect(currentUser.token).toBeDefined();
      expect(currentUser.username).toEqual(user.username);
      expect(currentUser.email).toEqual(user.email.toLowerCase());

      user = { ...currentUser.toJSON(), password: user.password };
    });
  });

  describe('User Sing In', () => {
    test('User Sing In', async () => {
      const currentUser = await caller.signIn({
        email: user.email,
        password: user.password,
      });

      expect(currentUser.id).toEqual(user.id);
      expect(currentUser.token).toBeDefined();
    });
  });

  describe('Get user by Id', () => {
    test('Get user by Id', async () => {
      const currentUser = (await caller.getUserById({
        userId: user.id,
      })) as any;

      expect(currentUser._id.toString()).toEqual(user.id);
    });
  });

  describe('Edit user', () => {
    test('Edit user', async () => {
      const userToBeUpdated = {
        username: `${user.username}_updated`,
      };

      const updatedUser = await caller
        .editUser({
          userId: user.id,
          ...userToBeUpdated,
        })
        .then((updatedUser) => updatedUser.toJSON());

      expect(updatedUser.id).toEqual(user.id);
      expect(updatedUser.username).toEqual(userToBeUpdated.username);

      user = { ...user, username: updatedUser.username };
    });
  });

  describe('Delete user', () => {
    let userToBeDeleted: any = generateMock(userSignUp);

    describe('Create user', () => {
      test('Create user', async () => {
        const currentUser = await caller.signUp(userToBeDeleted);

        expect(currentUser.id).toBeDefined();
        expect(currentUser.email).toEqual(userToBeDeleted.email.toLowerCase());

        userToBeDeleted = {
          ...currentUser.toJSON(),
          password: userToBeDeleted.password,
        };
      });
    });

    describe('Delete user', () => {
      test('Delete user', async () => {
        const response = await caller.deleteUser({
          userId: userToBeDeleted.id,
        });

        expect(response).toEqual('User deleted successfully');
      });
    });

    describe('Get user by Id', () => {
      test('Get user by Id', async () => {
        const deletedUser = (await caller.getUserById({
          userId: userToBeDeleted.id,
        })) as any;

        expect(deletedUser).toBeNull();
      });
    });
  });

  describe('Get current user', () => {
    test('Get current user', async () => {
      const currentUser = await caller.getMe();

      //! getMe() function always returns undefined

      expect((currentUser as any).id).toEqual(user.id);
    });
  });

  describe('Check if user exists', () => {
    test('Check if user exists', async () => {
      const currentUser = await caller.emaileExists({
        email: user.email,
      });

      //! emaileExists returns undefined instead intended data

      expect(currentUser).toBeDefined();
    });
  });

  describe('Check checkCode', () => {
    //! emaileExists returns undefined instead intended data, so we can't test checkCode temporary
  });

  describe('Get all users', () => {
    //* updated timeout to be 10000 because populate is taking
    test('Get all users', async () => {
      const users = await caller.getUsers();

      expect(users).toBeDefined();
    }, 10000);
  });

  describe('Update password', () => {
    const password = 'Updated@123';

    describe('Update password', () => {
      test('Update password', async () => {
        const currentUser = await caller.updatePassword({
          email: user.email,
          password,
        });
      });
    });

    describe('User sign in with new password', () => {
      test('User sign in with new password', async () => {
        const currentUser = await caller.signIn({
          email: user.email,
          password,
        });

        expect(currentUser.id).toEqual(user.id);
        expect(currentUser.token).toBeDefined();
      });
    });
  });

  describe('Send reset password email', () => {
    test('Send reset password email', async () => {
      const response = await caller.resetPasswordEmail({
        email: user.email,
      });

      expect(response).toEqual('Reset Token has been sent successfully');
    });
  });

  describe('Get google auth URL', () => {
    test('Get google auth URL', async () => {
      const auth = await caller.getGoogleAuthURL();

      expect(auth.status).toEqual('success');
      expect(auth.googleUrl).toBeDefined();
    });
  });

  describe('Google Sing In', () => {
    // TODO
  });

  describe('Reset user password', () => {
    //! reset password email is not returning token, can't test on temporary basis
  });
});
