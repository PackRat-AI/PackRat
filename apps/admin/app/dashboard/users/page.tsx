'use client';

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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DeleteButton } from 'admin-app/components/delete-button';
import { SearchInput } from 'admin-app/components/search-input';
import { type AdminUser, deleteUser, getUsers, restoreUser } from 'admin-app/lib/api';
import { formatDate } from 'admin-app/lib/date';
import { queryKeys } from 'admin-app/lib/queryKeys';
import { cn } from 'admin-app/lib/utils';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className="h-10 bg-muted/30 border-b border-border/60" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={`skeleton-row-${i}`}
          className="flex gap-4 px-4 py-3 border-b border-border/30 last:border-0"
        >
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-8" />
        </div>
      ))}
    </div>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const queryClient = useQueryClient();
  const isDeleted = !!user.deletedAt;

  const { mutateAsync: handleDelete } = useMutation({
    mutationFn: () => deleteUser(user.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
    },
  });

  const { mutateAsync: handleRestore } = useMutation({
    mutationFn: () => restoreUser(user.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
    },
  });

  return (
    <TableRow className={cn('hover:bg-muted/20', isDeleted && 'opacity-50')}>
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
          {isDeleted && (
            <p className="text-xs text-destructive">
              Deleted {user.deletedAt ? formatDate(new Date(user.deletedAt)) : ''}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'} className="text-xs">
          {user.role ?? 'USER'}
        </Badge>
      </TableCell>
      <TableCell>
        <span
          className={cn(
            'text-xs font-medium',
            user.emailVerified ? 'text-green-500' : 'text-muted-foreground',
          )}
        >
          {user.emailVerified ? 'Yes' : 'No'}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {user.createdAt ? formatDate(new Date(user.createdAt)) : '—'}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {user.lastActiveAt ? formatDate(new Date(user.lastActiveAt)) : '—'}
        </span>
      </TableCell>
      <TableCell>
        {isDeleted ? (
          <button
            type="button"
            onClick={() => handleRestore()}
            className="text-xs text-primary underline underline-offset-2 hover:no-underline"
          >
            Restore
          </button>
        ) : (
          <DeleteButton
            label={user.email}
            description="The user will be soft-deleted and can be restored later."
            onConfirm={async () => {
              await handleDelete();
            }}
          />
        )}
      </TableCell>
    </TableRow>
  );
}

export default function UsersPage() {
  const searchParams = useSearchParams();
  const q = searchParams?.get('q') ?? undefined;
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const {
    data: result,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.admin.users(q),
    queryFn: () => getUsers({ q, includeDeleted }),
  });

  const users = result?.data ?? [];
  const total = result?.total ?? 0;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Users</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Manage registered accounts on the platform.
        </p>
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <SearchInput placeholder="Search by email or name…" />
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="rounded"
            />
            Show deleted
          </label>
        </div>
        {isError ? (
          <p className="text-sm text-destructive py-4">
            Failed to load users. Check that the API is reachable.
          </p>
        ) : isLoading ? (
          <TableSkeleton />
        ) : (
          <>
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-medium text-xs uppercase tracking-wide">
                      User
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide">
                      Role
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide">
                      Verified
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide">
                      Joined
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide">
                      Last Active
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
              {users.length.toLocaleString()} of {total.toLocaleString()} user
              {total !== 1 ? 's' : ''}
              {q ? ` matching "${q}"` : ''}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
