import { toRecord } from '@packrat/guards';
import { safeJsonStringify } from '@packrat/utils';
import { defineCommand } from 'citty';
import { getUserClient } from '../../api/client';
import { requireAuth, runApi } from '../../api/run';
import { printSummary } from '../../shared';

const getCmd = defineCommand({
  meta: { name: 'profile', description: 'Print the current user profile.' },
  async run() {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi({ promise: client.user.profile.get(), action: 'get profile' });
    // Endpoint returns { success, user: { firstName, ... } }
    const user = toRecord(toRecord(data).user);
    printSummary({
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
      title: 'Profile',
    });
  },
});

const updateCmd = defineCommand({
  meta: { name: 'update', description: 'Update profile fields.' },
  args: {
    'first-name': { type: 'string' },
    'last-name': { type: 'string' },
    email: { type: 'string' },
    avatar: { type: 'string', description: 'Avatar URL' },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const body: Record<string, unknown> = {};
    if (args['first-name']) body.firstName = args['first-name'];
    if (args['last-name']) body.lastName = args['last-name'];
    if (args.email) body.email = args.email;
    if (args.avatar) body.avatarUrl = args.avatar;
    const data = await runApi({ promise: client.user.profile.put(body), action: 'update profile' });
    process.stdout.write(`${safeJsonStringify(data, null, 2)}\n`);
  },
});

export default defineCommand({
  meta: { name: 'user', description: 'View or update the signed-in user profile.' },
  subCommands: {
    profile: () => Promise.resolve(getCmd),
    update: () => Promise.resolve(updateCmd),
  },
});
