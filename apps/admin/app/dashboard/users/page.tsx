import { Badge } from '@packrat/web-ui/components/badge';
import { Skeleton } from '@packrat/web-ui/components/skeleton';
import { Suspense } from 'react';
import { SearchableTable, type Column } from 'admin-app/components/searchable-table';
import { formatDate } from 'admin-app/lib/date';
import { getUsers, type AdminUser } from 'admin-app/lib/api';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Users' };

const columns: Column<AdminUser>[] = [
  {
    key: 'email',
    header: 'Email',
    render: (u) => (
      <div>
        <p className="text-sm font-medium">{u.email}</p>
        {(u.firstName || u.lastName) && (
          <p className="text-xs text-muted-foreground">
            {[u.firstName, u.lastName].filter(Boolean).join(' ')}
          </p>
        )}
      </div>
    ),
  },
  {
    key: 'role',
    header: 'Role',
    render: (u) => (
      <Badge
        variant={u.role === 'ADMIN' ? 'default' : 'secondary'}
        className="text-xs font-medium"
      >
        {u.role ?? 'USER'}
      </Badge>
    ),
  },
  {
    key: 'verified',
    header: 'Verified',
    render: (u) => (
      <span className={`text-xs font-medium ${u.emailVerified ? 'text-green-500' : 'text-muted-foreground'}`}>
        {u.emailVerified ? 'Yes' : 'No'}
      </span>
    ),
  },
  {
    key: 'joined',
    header: 'Joined',
    render: (u) => (
      <span className="text-sm text-muted-foreground">
        {u.createdAt ? formatDate(new Date(u.createdAt)) : '—'}
      </span>
    ),
  },
];

async function UsersContent() {
  const users = await getUsers(100);
  return (
    <SearchableTable
      data={users}
      columns={columns}
      searchPlaceholder="Search by email or name…"
      emptyMessage="No users found."
      getSearchText={(u) =>
        [u.email, u.firstName, u.lastName, u.role].filter(Boolean).join(' ')
      }
    />
  );
}

function UsersSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-64" />
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <div className="h-10 bg-muted/30 border-b border-border/60" />
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeletons
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-border/30 last:border-0">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Users</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Manage registered accounts on the platform.
        </p>
      </div>
      <Suspense fallback={<UsersSkeleton />}>
        <UsersContent />
      </Suspense>
    </div>
  );
}
