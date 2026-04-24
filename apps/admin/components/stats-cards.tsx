import { Card, CardContent, CardHeader, CardTitle } from '@packrat/web-ui/components/card';
import type { AdminStats } from 'admin-app/lib/api';
import { Backpack, CheckCircle, Package, Users } from 'lucide-react';

interface StatsCardsProps {
  stats: AdminStats;
}

const cards = (stats: AdminStats) => [
  {
    title: 'Total Users',
    value: stats.users.toLocaleString(),
    icon: Users,
    description: 'Registered accounts',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    title: 'Total Packs',
    value: stats.packs.toLocaleString(),
    icon: Backpack,
    description: 'Active packing lists',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    title: 'Catalog Items',
    value: stats.items.toLocaleString(),
    icon: Package,
    description: 'Gear in the catalog',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
  },
  {
    title: 'System Health',
    value: 'Healthy',
    icon: CheckCircle,
    description: 'All systems operational',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
  },
];

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards(stats).map((card) => (
        <Card key={card.title} className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${card.bg}`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tracking-tight">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
