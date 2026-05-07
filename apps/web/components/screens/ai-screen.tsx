'use client';
import { Bot, Plus, Send, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from 'web-app/lib/utils';
import { useWeight } from 'web-app/lib/weight-context';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  packSuggestion?: PackSuggestion;
  toolCalls?: string[];
}

interface PackSuggestion {
  name: string;
  items: { name: string; brand: string; weight: number; category: string }[];
}

const STARTER_PROMPTS = [
  'Build me a 3-season PCT shelter kit under 2kg',
  'Optimize my current pack',
  'What gear do I need for a 20°F trip?',
  'Best ultralight tarp vs tent options?',
];

const MOCK_RESPONSES: Record<
  string,
  { content: string; toolCalls: string[]; packSuggestion?: PackSuggestion }
> = {
  'Build me a 3-season PCT shelter kit under 2kg': {
    toolCalls: ['🔍 Searching catalog…', '⚖️ Calculating weights…', '📋 Building pack suggestion…'],
    content:
      "Here's a 3-season PCT shelter kit optimized for under 2kg. This setup covers everything from desert heat to unexpected mountain snow, keeping you protected without sacrificing too much weight.",
    packSuggestion: {
      name: '3-Season PCT Shelter Kit',
      items: [
        { name: 'Solplex Tent', brand: 'Zpacks', weight: 340, category: 'Shelter' },
        {
          name: 'Revelation 20° Quilt',
          brand: 'Enlightened Equipment',
          weight: 397,
          category: 'Sleep System',
        },
        {
          name: 'NeoAir XLite Max SV',
          brand: 'Therm-a-Rest',
          weight: 340,
          category: 'Sleep System',
        },
        {
          name: 'Sea to Summit Stuff Sack 4L',
          brand: 'Sea to Summit',
          weight: 25,
          category: 'Other',
        },
      ],
    },
  },
  'Optimize my current pack': {
    toolCalls: [
      '⚖️ Analyzing current pack…',
      '🧠 Finding optimizations…',
      '📊 Ranking suggestions…',
    ],
    content:
      'I analyzed your **3-Season PCT Thru-Hike** pack (6.8 lbs base). Here are 3 high-impact swaps to bring you under 5 lbs:\n\n• **Swap shelter**: Copper Spur HV UL2 → Zpacks Solplex saves **487g**\n• **Swap sleep**: Ohm sleeping bag → EE Revelation Quilt saves **283g**\n• **Swap pack**: Osprey Exos 58 → Zpacks Arc Blast saves **610g**\n\nTotal savings: ~1.38 lbs — bringing you to **5.4 lbs base weight**.',
  },
  'What gear do I need for a 20°F trip?': {
    toolCalls: ['🌤 Checking weather data…', '🔍 Searching catalog…', '⚖️ Calculating weights…'],
    content:
      "For a 20°F trip you'll need a sleep system rated to at least 15°F for comfort, insulated layers, a 4-season or convertible shelter, and waterproof outerwear. Here's a recommended kit:",
    packSuggestion: {
      name: '20°F Winter Kit',
      items: [
        {
          name: 'Ohm 20° Sleeping Bag',
          brand: 'Western Mountaineering',
          weight: 680,
          category: 'Sleep System',
        },
        {
          name: 'NeoAir XLite Max SV',
          brand: 'Therm-a-Rest',
          weight: 340,
          category: 'Sleep System',
        },
        { name: 'Nano Puff Jacket', brand: 'Patagonia', weight: 312, category: 'Clothing' },
        { name: 'Altaplex Tent', brand: 'Zpacks', weight: 454, category: 'Shelter' },
        { name: 'inReach Mini 2', brand: 'Garmin', weight: 100, category: 'Navigation' },
      ],
    },
  },
  'Best ultralight tarp vs tent options?': {
    toolCalls: ['🔍 Searching catalog…', '📊 Comparing options…'],
    content:
      "Great question! Here's the quick breakdown:\n\n**Tarps** (e.g., Zpacks tarp ~180g): Lightest option, excellent ventilation, maximally versatile — but require skill to pitch well and offer less bug protection.\n\n**Single-wall tents** (e.g., Zpacks Solplex 340g): Best balance of weight, weatherproofness, and ease. Small condensation trade-off.\n\n**Double-wall tents** (e.g., Big Agnes Copper Spur ~997g): Most comfortable, best condensation management, but heaviest.\n\n**My recommendation**: For PCT thru-hiking, the Zpacks Solplex hits the sweet spot at 340g.",
  },
};

const DEFAULT_RESPONSE: { content: string; toolCalls: string[]; packSuggestion?: PackSuggestion } =
  {
    toolCalls: ['🔍 Searching catalog…', '🧠 Generating response…'],
    content:
      "That's a great question! I can help you plan, optimize, and gear up for any adventure. Try asking me to build a specific kit, optimize a pack, or recommend gear for particular conditions.",
  };

export function AIScreen() {
  const { fw } = useWeight();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setIsTyping(true);

    const response = MOCK_RESPONSES[text] ?? DEFAULT_RESPONSE;

    // Simulate tool calls
    for (const tool of response.toolCalls) {
      setActiveTools([tool]);
      await sleep(600);
    }
    setActiveTools([]);

    // Simulate streaming
    await sleep(300);
    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response.content,
      packSuggestion: response.packSuggestion,
      toolCalls: response.toolCalls,
    };
    setMessages((m) => [...m, assistantMsg]);
    setIsTyping(false);
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
                  onClick={() => sendMessage(prompt)}
                  className="rounded-xl bg-card border border-border px-4 py-3 text-left text-sm hover:bg-accent transition-colors"
                >
                  <span className="text-primary mr-2">→</span>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} fw={fw} />
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex flex-col gap-2">
            {activeTools.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pl-1">
                {activeTools.map((tool) => (
                  <span
                    key={tool}
                    className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary animate-pulse"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            )}
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
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-6 pt-3 md:px-6 border-t border-border shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              rows={1}
              placeholder="Ask about gear, build a kit…"
              className="w-full resize-none rounded-2xl bg-card border border-border px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary max-h-32 leading-relaxed"
              style={{ minHeight: 48 }}
            />
          </div>
          <button
            type="button"
            onClick={() => sendMessage(input)}
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

function MessageBubble({ message, fw }: { message: Message; fw: (g: number) => string }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full shrink-0 text-white text-xs font-bold',
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
          <FormattedContent content={message.content} />
        </div>

        {/* Pack suggestion card */}
        {message.packSuggestion && (
          <PackSuggestionCard suggestion={message.packSuggestion} fw={fw} />
        )}
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

function PackSuggestionCard({
  suggestion,
  fw,
}: {
  suggestion: PackSuggestion;
  fw: (g: number) => string;
}) {
  const total = suggestion.items.reduce((s, i) => s + i.weight, 0);
  const [imported, setImported] = useState(false);

  return (
    <div className="w-full rounded-2xl bg-card border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">
            Pack Suggestion
          </p>
          <p className="font-semibold text-sm mt-0.5">{suggestion.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-bold text-sm">{fw(total)}</p>
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-border">
        {suggestion.items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{item.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {item.brand} · {item.category}
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground shrink-0">
              {fw(item.weight)}
            </span>
          </div>
        ))}
      </div>

      {/* Import button */}
      <div className="px-4 py-3 border-t border-border">
        <button
          type="button"
          onClick={() => setImported(true)}
          className={cn(
            'w-full rounded-xl py-2.5 text-xs font-semibold transition-all flex items-center justify-center gap-2',
            imported
              ? 'bg-[#30d158]/15 text-[#30d158]'
              : 'bg-primary text-white hover:bg-primary/90 active:scale-[0.98]',
          )}
        >
          {imported ? (
            'Imported to Packs ✓'
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              Import to Pack
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
