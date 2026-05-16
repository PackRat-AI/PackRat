import { defineCommand } from 'citty';
import { getUserClient } from '../../api/client';
import { requireAuth, runApi } from '../../api/run';

const listCmd = defineCommand({
  meta: { name: 'list', description: 'List feed posts.' },
  args: {
    page: { type: 'string', default: '1' },
    limit: { type: 'string', default: '20' },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi(
      client.feed.get({
        query: { page: Number.parseInt(args.page, 10), limit: Number.parseInt(args.limit, 10) },
      }),
      { action: 'list feed' },
    );
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  },
});

const postCmd = defineCommand({
  meta: { name: 'post', description: 'Create a feed post.' },
  args: {
    caption: { type: 'positional', required: true, description: 'Caption text' },
    images: { type: 'string', description: 'Comma-separated image keys' },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const images = args.images
      ? args.images
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const data = await runApi(client.feed.post({ caption: args.caption, images }), {
      action: 'create feed post',
    });
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  },
});

const likeCmd = defineCommand({
  meta: { name: 'like', description: 'Toggle like on a feed post.' },
  args: { id: { type: 'positional', required: true, description: 'Post ID' } },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi(client.feed({ postId: args.id }).like.post({}), {
      action: 'toggle post like',
      resourceHint: `post ${args.id}`,
    });
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  },
});

const commentCmd = defineCommand({
  meta: { name: 'comment', description: 'Comment on a feed post.' },
  args: {
    id: { type: 'positional', required: true, description: 'Post ID' },
    content: { type: 'string', required: true, description: 'Comment text' },
    parent: { type: 'string', description: 'Parent comment ID for replies' },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi(
      client.feed({ postId: args.id }).comments.post({
        content: args.content,
        parentCommentId: args.parent ? Number.parseInt(args.parent, 10) : undefined,
      }),
      { action: 'create feed comment', resourceHint: `post ${args.id}` },
    );
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  },
});

export default defineCommand({
  meta: { name: 'feed', description: 'Social feed posts, likes, and comments.' },
  subCommands: {
    list: () => Promise.resolve(listCmd),
    post: () => Promise.resolve(postCmd),
    like: () => Promise.resolve(likeCmd),
    comment: () => Promise.resolve(commentCmd),
  },
});
