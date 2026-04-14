import { Badge } from '@packrat/web-ui/components/badge';
import { Skeleton } from '@packrat/web-ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@packrat/web-ui/components/table';
import { Suspense } from 'react';
import { DeleteButton } from 'admin-app/components/delete-button';
import { SearchInput } from 'admin-app/components/search-input';
import { deleteUserAction } from 'admin-app/lib/actions';
import { formatDate } from 'admin-app/lib/date';
import { getUsers, type AdminUser } from 'admin-app/lib/api';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Users' };

interface UsersPageProps {
  searchParams: Promise<{ q?: string }>;
}

async function UsersTable({ q }: { q?: string }) {
  const users = await getUsers(100, 0, q);

  return (
    <>
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-medium text-xs uppercase tracking-wide">User</TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wide">Role</TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wide">Verified</TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wide">Joined</TableHead>
              <TableHead className="font-medium text-xs uppercase tracking-wide w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No users found{q ? ` matching "${q}"` : ''}.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => <UserRow key={u.id} user={u} />)
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {users.length.toLocaleString()} user{users.length !== 1 ? 's' : ''}
        {q ? ` matching "${q}"` : ''}
      </p>
    </>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  return (
    <TableRow className="hover:bg-muted/20">
      <TableCell>
        <div>
          <p className="text-sm font-medium">
            {user.firstName || user.lastName
              ? [user.firstName, user.lastName].filter(Boolean).join(' ')
              : user.email}
          </p>
          {(user.firstName || user.lastName) && (
            <p className="text-xs text-muted-foreground">{user.email}</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'} className="text-xs">
          {user.role ?? 'USER'}
        </Badge>
      </TableCell>
      <TableCell>
        <span className={`text-xs font-medium ${user.emailVerified ? 'text-green-500' : 'text-muted-foreground'}`}>
          {user.emailVerified ? 'Yes' : 'No'}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {user.createdAt ? formatDate(new Date(user.createdAt)) : '—'}
        </span>
      </TableCell>
      <TableCell>
        <DeleteButton
          label={user.email}
          description="The user account and all associated data will be permanently deleted."
          onConfirm={async () => {
            'use server';
            await deleteUserAction(user.id);
          }}
        />
      </TableCell>
    </TableRow>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className="h-10 bg-muted/30 border-b border-border/60" />
      {Array.from({ length: 8 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-border/30 last:border-0">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-8" />
        </div>
      ))}
    </div>
  );
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const { q } = await searchParams;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Users</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage registered accounts on the platform.</p>
      </div>
      <div className="space-y-4">
        <SearchInput placeholder="Search by email or name…" />
        <Suspense fallback={<TableSkeleton />}>
          <UsersTable q={q} />
        </Suspense>
      </div>
    </div>
  );
}
