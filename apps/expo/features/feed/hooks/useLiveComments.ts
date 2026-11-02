import { useQueryClient } from '@tanstack/react-query';
import { getApiBaseUrl } from 'expo-app/lib/api/getBaseUrl';
import { getSessionToken } from 'expo-app/lib/api/packrat';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { listComments } from '../lib/feedApi';
import {
  isCommentsChangedSignal,
  LIVE_KEEPALIVE_MS,
  liveCommentsUrl,
  liveReconnectDelayMs,
} from '../utils/liveComments';
import { updateCachedPost } from './postCache';

/**
 * React Native's WebSocket accepts request headers as a third argument (see
 * `react-native/Libraries/WebSocket/WebSocket.js`); the DOM typings it is declared with stop at two.
 * A constructor with fewer parameters is assignable to this wider signature, so no cast is needed.
 */
const HeaderedWebSocket: new (
  url: string,
  protocols: string[] | undefined,
  options: { headers: Record<string, string> },
) => WebSocket = WebSocket;

import { feedKeys } from './queryKeys';

/**
 * Keeps an open thread current: listens on the post's live channel and re-reads the comments each
 * time they change. The server only ever says "something changed"; the re-read goes through the
 * normal comments endpoint, which applies blocks and moderation for this viewer. A re-read also
 * follows every reconnect, since signals sent while the socket was down are lost. Mirrors
 * `CommentsLiveUpdates.swift`.
 */
export function useLiveComments(postId: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let keepalive: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let hasConnected = false;

    const refresh = async () => {
      try {
        const comments = await listComments(postId);
        if (cancelled) return;
        queryClient.setQueryData(feedKeys.comments(postId), comments);
        updateCachedPost({
          queryClient,
          postId,
          update: (p) => ({ ...p, commentCount: comments.length }),
        });
      } catch {
        // A failed quiet re-read keeps what is on screen.
      }
    };

    const connect = async () => {
      if (cancelled) return;
      const token = await getSessionToken();
      if (cancelled || !token) return;
      let opened = false;
      // React Native's WebSocket takes request headers as a third argument.
      const ws = new HeaderedWebSocket(liveCommentsUrl(getApiBaseUrl(), postId), undefined, {
        headers: { Authorization: `Bearer ${token}` },
      });
      socket = ws;
      ws.onopen = () => {
        // The pong is the first frame back, which proves the upgrade was accepted.
        ws.send('ping');
        keepalive = setInterval(() => ws.send('ping'), LIVE_KEEPALIVE_MS);
      };
      ws.onmessage = (event) => {
        if (!opened) {
          opened = true;
          if (hasConnected) refresh();
          hasConnected = true;
          failures = 0;
        }
        if (isCommentsChangedSignal(event.data)) refresh();
      };
      ws.onclose = () => {
        clearInterval(keepalive);
        if (cancelled) return;
        failures = opened ? 1 : failures + 1;
        retry = setTimeout(connect, liveReconnectDelayMs(failures));
      };
    };

    connect();
    // Android drops sockets in the background; reconnect and catch up on return.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || cancelled) return;
      if (socket && socket.readyState !== WebSocket.OPEN) {
        clearTimeout(retry);
        socket.close();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
      clearTimeout(retry);
      clearInterval(keepalive);
      socket?.close();
    };
  }, [postId, queryClient]);
}
