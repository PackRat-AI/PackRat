'use client';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Cloud,
  CreditCard,
  Globe,
  HardDrive,
  Info,
  Key,
  Lock,
  Mail,
  Moon,
  Palette,
  Shield,
  Smartphone,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import type React from 'react';
import { useState } from 'react';
import { ConfirmDialog } from 'web-app/components/modals';
import { cn } from 'web-app/lib/utils';
import { useWeight } from 'web-app/lib/weight-context';

interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { unit, setUnit } = useWeight();
  const { theme, setTheme } = useTheme();
  const darkMode = theme === 'dark';
  const [notifications, setNotifications] = useState(true);
  const [cloudSync, setCloudSync] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="text-primary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold text-lg">Settings</h1>
        </div>
      </div>

      <div className="px-4 py-4 md:px-6 space-y-4 max-w-lg mx-auto md:max-w-none">
        {/* Account */}
        <SettingsGroup title="Account">
          <SettingsRow
            icon={<User className="h-4 w-4" />}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            label="Edit Profile"
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
          <SettingsRow
            icon={<Mail className="h-4 w-4" />}
            iconBg="bg-[#30d158]/15"
            iconColor="text-[#30d158]"
            label="Email"
            value="alex@packrat.app"
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
          <SettingsRow
            icon={<Key className="h-4 w-4" />}
            iconBg="bg-[#ff9f0a]/15"
            iconColor="text-[#ff9f0a]"
            label="Change Password"
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
          <SettingsRow
            icon={<CreditCard className="h-4 w-4" />}
            iconBg="bg-[#bf5af2]/15"
            iconColor="text-[#bf5af2]"
            label="Subscription"
            value="Free"
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
        </SettingsGroup>

        {/* Preferences */}
        <SettingsGroup title="Preferences">
          <SettingsRow
            icon={<Moon className="h-4 w-4" />}
            iconBg="bg-[#5e5ce6]/15"
            iconColor="text-[#5e5ce6]"
            label="Dark Mode"
            trailing={
              <Toggle checked={darkMode} onChange={(v) => setTheme(v ? 'dark' : 'light')} />
            }
          />
          <SettingsRow
            icon={<Zap className="h-4 w-4" />}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            label="Weight Units"
            trailing={
              <div className="flex rounded-xl bg-muted p-0.5">
                <button
                  type="button"
                  onClick={() => setUnit('g')}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                    unit === 'g' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                  )}
                >
                  g
                </button>
                <button
                  type="button"
                  onClick={() => setUnit('oz')}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                    unit === 'oz' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                  )}
                >
                  oz
                </button>
              </div>
            }
          />
          <SettingsRow
            icon={<Globe className="h-4 w-4" />}
            iconBg="bg-[#64d2ff]/15"
            iconColor="text-[#64d2ff]"
            label="Language"
            value="English"
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
          <SettingsRow
            icon={<Palette className="h-4 w-4" />}
            iconBg="bg-[#ff6b35]/15"
            iconColor="text-[#ff6b35]"
            label="App Icon"
            value="Default"
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
        </SettingsGroup>

        {/* Notifications */}
        <SettingsGroup title="Notifications">
          <SettingsRow
            icon={<Bell className="h-4 w-4" />}
            iconBg="bg-[#ff9f0a]/15"
            iconColor="text-[#ff9f0a]"
            label="Push Notifications"
            trailing={<Toggle checked={notifications} onChange={setNotifications} />}
          />
          <SettingsRow
            icon={<Mail className="h-4 w-4" />}
            iconBg="bg-[#30d158]/15"
            iconColor="text-[#30d158]"
            label="Email Notifications"
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
        </SettingsGroup>

        {/* Data & Storage */}
        <SettingsGroup title="Data & Storage">
          <SettingsRow
            icon={<Cloud className="h-4 w-4" />}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            label="Cloud Sync"
            trailing={<Toggle checked={cloudSync} onChange={setCloudSync} />}
          />
          <SettingsRow
            icon={<HardDrive className="h-4 w-4" />}
            iconBg="bg-muted"
            iconColor="text-muted-foreground"
            label="Storage Used"
            value="12.4 MB"
          />
          <SettingsRow
            icon={<Smartphone className="h-4 w-4" />}
            iconBg="bg-muted"
            iconColor="text-muted-foreground"
            label="Export Data"
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
        </SettingsGroup>

        {/* Privacy & Security */}
        <SettingsGroup title="Privacy & Security">
          <SettingsRow
            icon={<Lock className="h-4 w-4" />}
            iconBg="bg-[#fe4336]/15"
            iconColor="text-[#fe4336]"
            label="Privacy Settings"
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
          <SettingsRow
            icon={<Shield className="h-4 w-4" />}
            iconBg="bg-[#30d158]/15"
            iconColor="text-[#30d158]"
            label="Two-Factor Auth"
            value="Enabled"
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
        </SettingsGroup>

        {/* About */}
        <SettingsGroup title="About">
          <SettingsRow
            icon={<Info className="h-4 w-4" />}
            iconBg="bg-muted"
            iconColor="text-muted-foreground"
            label="Version"
            value="1.0.0 (Build 42)"
          />
          <SettingsRow
            icon={<Globe className="h-4 w-4" />}
            iconBg="bg-muted"
            iconColor="text-muted-foreground"
            label="Terms of Service"
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
          <SettingsRow
            icon={<Shield className="h-4 w-4" />}
            iconBg="bg-muted"
            iconColor="text-muted-foreground"
            label="Privacy Policy"
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
        </SettingsGroup>

        {/* Danger Zone */}
        <SettingsGroup title="Danger Zone">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-destructive/10 transition-colors rounded-2xl"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/15 shrink-0">
              <Trash2 className="h-4 w-4 text-destructive" />
            </div>
            <span className="flex-1 text-sm font-medium text-destructive text-left">
              Delete Account
            </span>
            <ChevronRight className="h-4 w-4 text-destructive/50" />
          </button>
        </SettingsGroup>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {}}
        title="Delete Account?"
        description="This will permanently delete all your packs, gear, and data. This action cannot be undone."
        confirmLabel="Delete Account"
        destructive
      />
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
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
  iconColor,
  label,
  value,
  trailing,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-accent/50 transition-colors text-left"
    >
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-xl shrink-0',
          iconBg,
          iconColor,
        )}
      >
        {icon}
      </div>
      <span className="flex-1 text-sm font-medium">{label}</span>
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
      {trailing}
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-7 w-12 rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted',
      )}
    >
      <div
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'left-6' : 'left-1',
        )}
      />
    </button>
  );
}
