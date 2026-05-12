'use client';
import {
  gramsToLbs,
  useCurrentUser,
  usePacks,
  useTrips,
  useUpdateProfileMutation,
  useUserProfile,
} from '@packrat/app';
import {
  Backpack,
  Bell,
  Camera,
  Check,
  ChevronRight,
  Crown,
  Edit3,
  HelpCircle,
  Lock,
  LogOut,
  Moon,
  Package,
  Settings,
  ShoppingBag,
  Star,
  Trophy,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import type { Screen } from 'web-app/components/app-shell';
import { BetaBadge } from 'web-app/components/beta-badge';
import { ConfirmDialog, Modal, NotificationsPanel } from 'web-app/components/modals';
import { SettingsScreen } from 'web-app/components/screens/settings-screen';
import { authClient } from 'web-app/lib/auth-client';
import type { PackWithWeights } from 'web-app/lib/types';
import { cn } from 'web-app/lib/utils';
import { useWeight } from 'web-app/lib/weight-context';

interface ProfileScreenProps {
  navigate: (s: Screen) => void;
}

export function ProfileScreen({ navigate }: ProfileScreenProps) {
  const { fw: _fw } = useWeight();
  const router = useRouter();
  const [isPremium, setIsPremium] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');

  const { data: packsRaw } = usePacks();
  const packs = (packsRaw as PackWithWeights[] | undefined) ?? []; // safe-cast: API boundary narrowing to local weight-augmented type
  const { data: meData } = useCurrentUser();
  const { data: profileData } = useUserProfile();
  const { data: tripsData } = useTrips();

  const updateProfile = useUpdateProfileMutation();

  const user = meData?.user;
  const profile = profileData?.user;
  const tripsCount = Array.isArray(tripsData) ? tripsData.length : 0;

  const avgBase =
    packs.length > 0 ? packs.reduce((acc, p) => acc + p.baseWeight, 0) / packs.length : 0;

  const memberSince = profile?.createdAt ? new Date(profile.createdAt).getFullYear() : null;

  if (showSettings) {
    return <SettingsScreen onBack={() => setShowSettings(false)} />;
  }

  return (
    <div className="px-4 pt-5 pb-28 md:px-6 md:pt-6 space-y-4 max-w-lg mx-auto md:max-w-none">
      {/* Avatar + Name */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-[#bf5af2] flex items-center justify-center text-white text-2xl font-bold">
            {(user?.firstName?.[0] ?? 'U').toUpperCase()}
          </div>
          {isPremium && (
            <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-[#ff9f0a] flex items-center justify-center">
              <Crown className="h-3 w-3 text-white" />
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setEditFirstName(user?.firstName ?? '');
              setEditLastName(user?.lastName ?? '');
              setShowEditProfile(true);
            }}
            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors"
          >
            <Camera className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-xl">
              {user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'User' : 'User'}
            </h1>

            {isPremium ? (
              <span className="rounded-full bg-[#ff9f0a]/20 px-2 py-0.5 text-[10px] font-bold text-[#ff9f0a] uppercase">
                Premium
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
                Free
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {profile?.email ?? user?.email ?? ''}
            {memberSince ? ` · Member since ${memberSince}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditFirstName(user?.firstName ?? '');
            setEditLastName(user?.lastName ?? '');
            setShowEditProfile(true);
          }}
          className="p-2 rounded-xl bg-muted hover:bg-accent transition-colors"
        >
          <Edit3 className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Packs', value: packs.length, icon: Backpack },
          { label: 'Trips', value: tripsCount, icon: Trophy },
          { label: 'Avg Base', value: gramsToLbs(avgBase), icon: Star },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-card border border-border p-3 text-center">
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Upgrade banner (free users) */}
      {!isPremium && (
        <button
          type="button"
          onClick={() => setShowUpgradeModal(true)}
          className="w-full rounded-2xl bg-gradient-to-r from-[#bf5af2]/20 to-[#0385ff]/20 border border-[#bf5af2]/30 p-4 text-left hover:from-[#bf5af2]/30 hover:to-[#0385ff]/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Crown className="h-8 w-8 text-[#ff9f0a] shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Upgrade to Premium</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Unlimited packs, AI credits, advanced analytics
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </button>
      )}

      {/* Quick links */}
      <div className="space-y-1">
        <SettingsGroup title="Gear">
          <SettingsRow
            icon={<Package className="h-4 w-4 text-[#bf5af2]" />}
            iconBg="bg-[#bf5af2]/15"
            label="Gear Inventory"
            onClick={() => navigate('gear-inventory')}
          />
          <SettingsRow
            icon={<ShoppingBag className="h-4 w-4 text-[#30d158]" />}
            iconBg="bg-[#30d158]/15"
            label="Shopping List"
            badge={<BetaBadge />}
            onClick={() => navigate('shopping-list')}
          />
        </SettingsGroup>

        <SettingsGroup title="Account">
          <SettingsRow
            icon={<Settings className="h-4 w-4 text-muted-foreground" />}
            iconBg="bg-muted"
            label="Settings"
            onClick={() => setShowSettings(true)}
          />
          <SettingsRow
            icon={<Bell className="h-4 w-4 text-[#ff9f0a]" />}
            iconBg="bg-[#ff9f0a]/15"
            label="Notifications"
            badge={
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                3
              </span>
            }
            onClick={() => setShowNotifications(true)}
          />
          <SettingsRow
            icon={<Moon className="h-4 w-4 text-[#0385ff]" />}
            iconBg="bg-[#0385ff]/15"
            label="Dark Mode"
            trailing={
              <div className="h-6 w-11 rounded-full bg-primary relative">
                <div className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white" />
              </div>
            }
          />
          <SettingsRow
            icon={<Lock className="h-4 w-4 text-muted-foreground" />}
            iconBg="bg-muted"
            label="Privacy"
          />
        </SettingsGroup>

        <SettingsGroup title="Support">
          <SettingsRow
            icon={<HelpCircle className="h-4 w-4 text-[#0385ff]" />}
            iconBg="bg-[#0385ff]/15"
            label="Help & FAQ"
          />
        </SettingsGroup>

        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border px-4 py-3.5 text-destructive font-medium text-sm hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>

      <p className="text-center text-[11px] text-muted-foreground pb-4">
        PackRat v1.0.0 · Made for ultralight enthusiasts
      </p>

      {/* Notifications Panel */}
      <NotificationsPanel open={showNotifications} onClose={() => setShowNotifications(false)} />

      {/* Logout Confirmation */}
      <ConfirmDialog
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          void authClient.signOut().then(() => router.push('/auth'));
        }}
        title="Sign Out?"
        description="Are you sure you want to sign out of your account?"
        confirmLabel="Sign Out"
        destructive
      />

      {/* Upgrade Modal */}
      <Modal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Upgrade to Premium"
      >
        <div className="px-5 pb-6 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-[#bf5af2]/20 to-[#0385ff]/20 border border-[#bf5af2]/30 p-6 text-center">
            <Crown className="h-12 w-12 text-[#ff9f0a] mx-auto mb-3" />
            <h3 className="font-bold text-xl">PackRat Premium</h3>
            <p className="text-sm text-muted-foreground mt-1">$9.99/month or $79.99/year</p>
          </div>

          <div className="space-y-2">
            {[
              'Unlimited packs and gear items',
              'AI-powered pack optimization',
              'Advanced weight analytics',
              'Priority support',
              'Early access to new features',
              'No ads',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full bg-[#30d158]/15 flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 text-[#30d158]" />
                </div>
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsPremium(true);
                setShowUpgradeModal(false);
              }}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              Start Free Trial
            </button>
            <p className="text-center text-xs text-muted-foreground">
              7-day free trial, cancel anytime
            </p>
          </div>
        </div>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal open={showEditProfile} onClose={() => setShowEditProfile(false)} title="Edit Profile">
        <div className="px-5 pb-6 space-y-4">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-[#bf5af2] flex items-center justify-center text-white text-3xl font-bold">
                {(editFirstName[0] ?? user?.firstName?.[0] ?? 'U').toUpperCase()}
              </div>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary flex items-center justify-center"
              >
                <Camera className="h-4 w-4 text-white" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Tap to change photo</p>
          </div>

          <div>
            <label
              htmlFor="edit-first-name"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
            >
              First Name
            </label>
            <input
              id="edit-first-name"
              value={editFirstName}
              onChange={(e) => setEditFirstName(e.target.value)}
              className="w-full mt-1.5 rounded-xl bg-muted px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label
              htmlFor="edit-last-name"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
            >
              Last Name
            </label>
            <input
              id="edit-last-name"
              value={editLastName}
              onChange={(e) => setEditLastName(e.target.value)}
              className="w-full mt-1.5 rounded-xl bg-muted px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowEditProfile(false)}
              className="flex-1 py-3 rounded-xl bg-muted font-semibold text-sm hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                updateProfile.mutate(
                  {
                    firstName: editFirstName.trim() || undefined,
                    lastName: editLastName.trim() || undefined,
                  },
                  { onSuccess: () => setShowEditProfile(false) },
                );
              }}
              disabled={updateProfile.isPending}
              className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {updateProfile.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-1.5">
        {title}
      </p>
      <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({
  icon,
  iconBg,
  label,
  badge,
  trailing,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  badge?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-accent/50 transition-colors text-left"
    >
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-xl shrink-0', iconBg)}>
        {icon}
      </div>
      <span className="flex-1 text-sm font-medium">{label}</span>
      {badge}
      {trailing ?? <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}
