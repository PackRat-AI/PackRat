'use client';
import { weightClass } from '@packrat/app';
import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  CheckCircle,
  ExternalLink,
  Link,
  Mail,
  MessageCircle,
  Plus,
  Share2,
  Star,
  X,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { cn } from 'web-app/lib/utils';

// Local types used by GearDetailModal (v0 had these in a separate data file)
export type GearItem = {
  name: string;
  brand: string;
  category: string;
  weightGrams: number;
  price?: number | null;
  description?: string | null;
  url?: string | null;
};

export type Pack = {
  id: string;
  name: string;
};

// ─── Modal Wrapper ───────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, children, title, size = 'md' }: ModalProps) {
  if (!open) return null;

  const maxW = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-10 bg-card rounded-t-3xl md:rounded-2xl border border-border w-full',
          maxW,
          'max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 md:slide-in-from-bottom-0 md:zoom-in-95 duration-200',
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
            <h2 className="font-bold text-lg">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 -mr-1.5 rounded-full hover:bg-accent transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ─── Confirmation Dialog ─────────────────────────────────────────────────────
interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 bg-card rounded-2xl border border-border w-full max-w-xs p-5 animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center mb-5">
          <div
            className={cn(
              'h-12 w-12 rounded-full flex items-center justify-center mb-3',
              destructive ? 'bg-destructive/15' : 'bg-primary/15',
            )}
          >
            {destructive ? (
              <AlertTriangle className="h-6 w-6 text-destructive" />
            ) : (
              <Check className="h-6 w-6 text-primary" />
            )}
          </div>
          <h3 className="font-bold text-base">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1.5">{description}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-muted font-semibold text-sm hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              'flex-1 py-3 rounded-xl font-semibold text-sm transition-colors',
              destructive
                ? 'bg-destructive text-white hover:bg-destructive/90'
                : 'bg-primary text-white hover:bg-primary/90',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Share Pack Modal ────────────────────────────────────────────────────────
interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  packName: string;
  packId: string;
}

export function ShareModal({ open, onClose, packName, packId }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `packrat.app/pack/${packId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(`https://${shareUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOptions = [
    { label: 'Copy Link', icon: Link, action: copyLink },
    { label: 'Twitter/X', icon: Share2, action: () => {} },
    { label: 'Message', icon: MessageCircle, action: () => {} },
    { label: 'Email', icon: Mail, action: () => {} },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Share Pack">
      <div className="px-5 pb-6 space-y-4">
        <div className="rounded-xl bg-muted p-4">
          <p className="font-semibold text-sm">{packName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{shareUrl}</p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {shareOptions.map((opt) => {
            const Icon = opt.icon;
            const isLink = opt.label === 'Copy Link';
            return (
              <button
                type="button"
                key={opt.label}
                onClick={opt.action}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl p-3 transition-all',
                  isLink && copied ? 'bg-[#30d158]/15 text-[#30d158]' : 'bg-muted hover:bg-accent',
                )}
              >
                {isLink && copied ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5 text-foreground" />
                )}
                <span className="text-[11px] font-medium">
                  {isLink && copied ? 'Copied!' : opt.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Visibility
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 py-2.5 rounded-xl bg-primary/15 text-primary text-sm font-semibold"
            >
              Public
            </button>
            <button
              type="button"
              className="flex-1 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm font-semibold hover:text-foreground transition-colors"
            >
              Private Link
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Gear Item Detail Modal ──────────────────────────────────────────────────
interface GearDetailModalProps {
  open: boolean;
  onClose: () => void;
  item: GearItem | null;
  fw: (g: number) => string;
  onAddToPack?: () => void;
  onSaveToInventory?: () => void;
  isAdded?: boolean;
  isSaved?: boolean;
}

export function GearDetailModal({
  open,
  onClose,
  item,
  fw,
  onAddToPack,
  onSaveToInventory,
  isAdded,
  isSaved,
}: GearDetailModalProps) {
  if (!item) return null;

  const wc = weightClass(item.weightGrams);
  const wcStyles = {
    ultralight: { bg: 'bg-[#30d158]/15', text: 'text-[#30d158]', label: 'Ultralight' },
    lightweight: { bg: 'bg-[#ff9f0a]/15', text: 'text-[#ff9f0a]', label: 'Lightweight' },
    standard: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Standard' },
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="px-5 pb-6">
        {/* Header */}
        <div className="flex items-start justify-between py-4 border-b border-border">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {item.category}
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                  wcStyles[wc].bg,
                  wcStyles[wc].text,
                )}
              >
                {wcStyles[wc].label}
              </span>
            </div>
            <h2 className="font-bold text-xl">{item.name}</h2>
            <p className="text-sm text-muted-foreground">{item.brand}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-full hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Placeholder image */}
        <div className="my-4 rounded-2xl bg-gradient-to-br from-primary/10 to-[#30d158]/10 border border-border h-48 flex items-center justify-center">
          <span className="text-4xl font-bold text-primary/20">
            {item.brand.slice(0, 2).toUpperCase()}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-muted p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Weight</p>
            <p className="text-lg font-bold mt-0.5">{fw(item.weightGrams)}</p>
          </div>
          <div className="rounded-xl bg-muted p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Price</p>
            <p className="text-lg font-bold mt-0.5">{item.price ? `$${item.price}` : '—'}</p>
          </div>
          <div className="rounded-xl bg-muted p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Class</p>
            <p className={cn('text-lg font-bold mt-0.5', wcStyles[wc].text)}>
              {wcStyles[wc].label.slice(0, 2).toUpperCase()}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">{item.description}</p>

        {/* Reviews placeholder */}
        <div className="rounded-xl bg-card border border-border p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Community Reviews</h3>
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-[#ff9f0a] fill-[#ff9f0a]" />
              <span className="text-sm font-bold">4.8</span>
              <span className="text-xs text-muted-foreground">(127)</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Top rated by ultralight backpackers on PCT and CDT thru-hikes.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAddToPack}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm transition-all',
              isAdded
                ? 'bg-[#30d158]/15 text-[#30d158]'
                : 'bg-primary text-white hover:bg-primary/90',
            )}
          >
            {isAdded ? <CheckCircle className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isAdded ? 'Added to Pack' : 'Add to Pack'}
          </button>
          <button
            type="button"
            onClick={onSaveToInventory}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-semibold text-sm transition-all',
              isSaved
                ? 'bg-[#bf5af2]/15 text-[#bf5af2]'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <BookmarkPlus className="h-4 w-4" />
          </button>
        </div>

        {item.url && (
          <button
            type="button"
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            View on {item.brand} website
          </button>
        )}
      </div>
    </Modal>
  );
}

// ─── Create/Edit Pack Modal ──────────────────────────────────────────────────
interface PackFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string;
    targetWeightGrams?: number;
    tags: string[];
  }) => void;
  initialData?: { name: string; description: string; targetWeightGrams?: number; tags: string[] };
  mode: 'create' | 'edit';
}

export function PackFormModal({ open, onClose, onSave, initialData, mode }: PackFormModalProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [targetLbs, setTargetLbs] = useState(
    initialData?.targetWeightGrams
      ? String(Math.round(initialData.targetWeightGrams / 453.592))
      : '',
  );
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);

  const handleSave = () => {
    onSave({
      name: name.trim() || 'Untitled Pack',
      description: description.trim(),
      targetWeightGrams: targetLbs ? Math.round(parseFloat(targetLbs) * 453.592) : undefined,
      tags,
    });
    onClose();
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === 'create' ? 'New Pack' : 'Edit Pack'}>
      <div className="px-5 pb-6 space-y-4">
        <div>
          <label
            htmlFor="pack-name"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            Pack Name
          </label>
          <input
            id="pack-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. PCT Thru-Hike 2024"
            className="w-full mt-1.5 rounded-xl bg-muted px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label
            htmlFor="pack-description"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            Description
          </label>
          <textarea
            id="pack-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this pack for?"
            rows={2}
            className="w-full mt-1.5 rounded-xl bg-muted px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        <div>
          <label
            htmlFor="pack-target-weight"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            Target Base Weight (lbs)
          </label>
          <input
            id="pack-target-weight"
            type="number"
            value={targetLbs}
            onChange={(e) => setTargetLbs(e.target.value)}
            placeholder="e.g. 10"
            className="w-full mt-1.5 rounded-xl bg-muted px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label
            htmlFor="pack-tags"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            Tags
          </label>
          <div className="flex gap-2 mt-1.5">
            <input
              id="pack-tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add tag…"
              className="flex-1 rounded-xl bg-muted px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-4 py-2.5 rounded-xl bg-primary/15 text-primary text-sm font-semibold"
            >
              Add
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-muted font-semibold text-sm hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            {mode === 'create' ? 'Create Pack' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Notifications Panel ─────────────────────────────────────────────────────
interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'share' | 'system';
  title: string;
  description: string;
  time: string;
  read: boolean;
  avatar?: string;
}

const sampleNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'like',
    title: 'trailwitch_ liked your pack',
    description: '3-Season PCT Thru-Hike',
    time: '2m ago',
    read: false,
    avatar: 'TW',
  },
  {
    id: 'n2',
    type: 'comment',
    title: 'summit_seeker commented',
    description: '"Great gear choices!"',
    time: '1h ago',
    read: false,
    avatar: 'SS',
  },
  {
    id: 'n3',
    type: 'follow',
    title: 'alpenflow started following you',
    description: '',
    time: '3h ago',
    read: true,
    avatar: 'AF',
  },
  {
    id: 'n4',
    type: 'share',
    title: 'Your pack was shared',
    description: 'Weekend Backpacking shared 12 times',
    time: '1d ago',
    read: true,
  },
  {
    id: 'n5',
    type: 'system',
    title: 'AI Assistant updated',
    description: 'New PCT optimization features available',
    time: '2d ago',
    read: true,
  },
];

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ open, onClose }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState(sampleNotifications);

  const markAllRead = () => {
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Modal open={open} onClose={onClose} title="Notifications" size="md">
      <div className="pb-2">
        {unreadCount > 0 && (
          <div className="flex items-center justify-between px-5 py-2 border-b border-border">
            <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-primary font-semibold"
            >
              Mark all read
            </button>
          </div>
        )}
        <div className="divide-y divide-border">
          {notifications.map((n) => (
            <button
              type="button"
              key={n.id}
              onClick={() =>
                setNotifications((ns) => ns.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
              }
              className={cn(
                'w-full flex items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-accent/50',
                !n.read && 'bg-primary/5',
              )}
            >
              {n.avatar ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#bf5af2] text-white text-xs font-bold shrink-0">
                  {n.avatar}
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', !n.read ? 'font-semibold' : 'font-medium')}>
                  {n.title}
                </p>
                {n.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.description}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">{n.time}</p>
              </div>
              {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
