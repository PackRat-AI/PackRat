import { CHAT_FIXTURE_PORT, startChatAcceptanceServer } from './lib/chat-acceptance-server';

const fixture = await startChatAcceptanceServer();
console.log(`Chat fixture listening only on http://127.0.0.1:${CHAT_FIXTURE_PORT}`);
async function stop() {
  await fixture.stop();
  process.exit(0);
}
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
