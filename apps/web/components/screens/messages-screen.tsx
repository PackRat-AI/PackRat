'use client';
import { ChevronLeft, Send } from 'lucide-react';
import { useState } from 'react';
import { cn } from 'web-app/lib/utils';

interface Conversation {
  id: string;
  username: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
}

interface ChatMessage {
  id: string;
  fromMe: boolean;
  text: string;
  time: string;
}

const conversations: Conversation[] = [
  {
    id: 'c1',
    username: 'trailwitch_',
    avatar: 'TW',
    lastMessage: 'That Solplex is incredible in the wind',
    time: '2m',
    unread: 2,
  },
  {
    id: 'c2',
    username: 'summit_seeker',
    avatar: 'SS',
    lastMessage: 'What trekking poles do you use?',
    time: '1h',
    unread: 0,
  },
  {
    id: 'c3',
    username: 'alpenflow',
    avatar: 'AF',
    lastMessage: 'Check my Wonderland pack for inspo!',
    time: '3h',
    unread: 1,
  },
  {
    id: 'c4',
    username: 'knotted.miles',
    avatar: 'KM',
    lastMessage: 'Happy trails!',
    time: '1d',
    unread: 0,
  },
];

const mockChats: Record<string, ChatMessage[]> = {
  c1: [
    { id: 'm1', fromMe: false, text: 'Hey! Saw your PCT pack — super clean', time: '10:42 AM' },
    { id: 'm2', fromMe: true, text: 'Thanks! Took a while to dial it in', time: '10:44 AM' },
    { id: 'm3', fromMe: false, text: 'That Solplex is incredible in the wind', time: '10:45 AM' },
  ],
  c2: [
    { id: 'm1', fromMe: false, text: 'Great pack on your profile!', time: 'Yesterday' },
    { id: 'm2', fromMe: true, text: 'Thanks, years of iteration!', time: 'Yesterday' },
    { id: 'm3', fromMe: false, text: 'What trekking poles do you use?', time: 'Yesterday' },
  ],
  c3: [{ id: 'm1', fromMe: false, text: 'Check my Wonderland pack for inspo!', time: '3h ago' }],
  c4: [
    { id: 'm1', fromMe: true, text: 'Congrats on the FKT attempt!', time: 'Yesterday' },
    { id: 'm2', fromMe: false, text: 'Happy trails!', time: 'Yesterday' },
  ],
};

export function MessagesScreen() {
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chats, setChats] = useState(mockChats);

  const sendMessage = () => {
    if (!chatInput.trim() || !activeConvo) return;
    const newMsg: ChatMessage = {
      id: `m${Date.now()}`,
      fromMe: true,
      text: chatInput.trim(),
      time: 'Just now',
    };
    setChats((c) => ({ ...c, [activeConvo]: [...(c[activeConvo] ?? []), newMsg] }));
    setChatInput('');
  };

  if (activeConvo) {
    const convo = conversations.find((c) => c.id === activeConvo) ?? conversations[0];
    if (!convo) return null;
    const messages = chats[activeConvo] ?? [];
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 md:px-6 border-b border-border sticky top-0 z-10 bg-background">
          <button type="button" onClick={() => setActiveConvo(null)} className="text-primary">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#bf5af2] text-white text-xs font-bold shrink-0">
            {convo.avatar}
          </div>
          <p className="font-semibold text-sm">{convo.username}</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className={cn('flex', msg.fromMe ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
                  msg.fromMe
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-card border border-border rounded-bl-sm',
                )}
              >
                <p>{msg.text}</p>
                <p
                  className={cn(
                    'text-[10px] mt-1',
                    msg.fromMe ? 'text-white/60' : 'text-muted-foreground',
                  )}
                >
                  {msg.time}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="px-4 pb-6 pt-3 md:px-6 border-t border-border flex items-end gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Message…"
            className="flex-1 rounded-2xl bg-card border border-border px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!chatInput.trim()}
            className={cn(
              'h-11 w-11 rounded-full flex items-center justify-center transition-all',
              chatInput.trim() ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-5 pb-28 md:px-6 md:pt-6">
      <h1 className="text-2xl font-bold tracking-tight mb-4">Messages</h1>
      <div className="space-y-1">
        {conversations.map((convo) => (
          <button
            type="button"
            key={convo.id}
            onClick={() => setActiveConvo(convo.id)}
            className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border px-4 py-3.5 text-left hover:bg-accent/50 transition-colors"
          >
            <div className="relative shrink-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#bf5af2] text-white text-sm font-bold">
                {convo.avatar}
              </div>
              {convo.unread > 0 && (
                <div className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-[10px] text-white font-bold">{convo.unread}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className={cn('text-sm', convo.unread > 0 ? 'font-bold' : 'font-medium')}>
                  {convo.username}
                </p>
                <span className="text-[11px] text-muted-foreground shrink-0">{convo.time}</span>
              </div>
              <p
                className={cn(
                  'text-xs mt-0.5 truncate',
                  convo.unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground',
                )}
              >
                {convo.lastMessage}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
