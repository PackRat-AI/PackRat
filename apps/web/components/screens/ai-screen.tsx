'use client';
import { type UIMessage, useChat } from '@ai-sdk/react';
import { webEnv } from '@packrat/env/web';
import { DefaultChatTransport, type TextUIPart } from 'ai';
import Cookies from 'js-cookie';
import { Bot, Send, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from 'web-app/lib/utils';
import { useWeight } from 'web-app/lib/weight-context';

const STARTER_PROMPTS = [
  'Build me a 3-season PCT shelter kit under 2kg',
  'Optimize my current pack',
  'What gear do I need for a 20°F trip?',
  'Best ultralight tarp vs tent options?',
];

const API_BASE = webEnv.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

function getTextContent(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is TextUIPart => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export function AIScreen() {
  const { fw: _fw } = useWeight();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_BASE}/api/chat`,
        headers: () => ({ Authorization: `Bearer ${Cookies.get('access_token') ?? ''}` }),
        body: () => ({ date: new Date().toISOString() }),
      }),
    [],
  );

  const { messages, sendMessage, status } = useChat({ transport });

  const isTyping = status === 'submitted' || status === 'streaming';

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom when message count changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const submit = (text: string) => {
    if (!text.trim() || isTyping) return;
    sendMessage({ text: text.trim() });
    setInput('');
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-60px)] md:max-h-screen">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 md:px-6 md:pt-6 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">AI Assistant</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Powered by PackRat AI</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#30d158] animate-pulse" />
            <span className="text-xs text-muted-foreground">Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-xl">PackRat AI</h2>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">
                Your ultralight gear expert. Ask me anything about packs, gear, or trip planning.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  type="button"
                  key={prompt}
                  onClick={() => submit(prompt)}
                  className="rounded-xl bg-card border border-border px-4 py-3 text-left text-sm hover:bg-accent transition-colors"
                >
                  <span className="text-primary mr-2">→</span>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages
          .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
          .map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role as 'user' | 'assistant'}
              content={getTextContent(msg)}
            />
          ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-2.5 items-start">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary shrink-0">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                {[0, 0.15, 0.3].map((delay) => (
                  <div
                    key={delay}
                    className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
                    style={{ animationDelay: `${delay}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-6 pt-3 md:px-6 border-t border-border shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit(input);
                }
              }}
              rows={1}
              placeholder="Ask about gear, build a kit…"
              className="w-full resize-none rounded-2xl bg-card border border-border px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary max-h-32 leading-relaxed"
              style={{ minHeight: 48 }}
            />
          </div>
          <button
            type="button"
            onClick={() => submit(input)}
            disabled={!input.trim() || isTyping}
            className={cn(
              'h-12 w-12 rounded-full flex items-center justify-center shrink-0 transition-all',
              input.trim() && !isTyping
                ? 'bg-primary text-white hover:bg-primary/90 active:scale-95'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user';
  return (
    <div className={cn('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full shrink-0 text-white',
          isUser ? 'bg-[#636366]' : 'bg-primary',
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn('flex flex-col gap-2 max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-white rounded-tr-sm'
              : 'bg-card border border-border rounded-tl-sm',
          )}
        >
          <FormattedContent content={content} />
        </div>
      </div>
    </div>
  );
}

function parseBoldSegments(line: string): Array<{ text: string; bold: boolean }> {
  const segments: Array<{ text: string; bold: boolean }> = [];
  let remaining = line;
  while (remaining.length > 0) {
    const start = remaining.indexOf('**');
    if (start === -1) {
      segments.push({ text: remaining, bold: false });
      break;
    }
    if (start > 0) segments.push({ text: remaining.slice(0, start), bold: false });
    const end = remaining.indexOf('**', start + 2);
    if (end === -1) {
      segments.push({ text: remaining.slice(start), bold: false });
      break;
    }
    segments.push({ text: remaining.slice(start + 2, end), bold: true });
    remaining = remaining.slice(end + 2);
  }
  return segments;
}

function FormattedContent({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line) return <br key={i} />;
        return (
          <p key={i}>
            {parseBoldSegments(line).map((seg, j) =>
              seg.bold ? <strong key={j}>{seg.text}</strong> : seg.text,
            )}
          </p>
        );
      })}
    </div>
  );
}
