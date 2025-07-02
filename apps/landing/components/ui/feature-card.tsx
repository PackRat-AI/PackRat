import { LucideIcon } from 'landing-app/lib/icons';
import { cn } from 'landing-app/lib/utils';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
  color: string;
  className?: string;
}

export default function FeatureCard({
  title,
  description,
  icon,
  color,
  className,
}: FeatureCardProps) {
  const Icon = LucideIcon(icon);

  return (
    <div
      className={cn(
        'group relative h-full overflow-hidden rounded-2xl bg-card p-8 shadow-lg transition-all duration-300 hover:shadow-xl',
        className,
      )}
    >
      <div className="flex flex-col h-full">
        <div
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
          style={{ background: `${color}15` }}
        >
          {Icon && <Icon className="h-7 w-7" style={{ color: color }} />}
        </div>

        <h3 className="mb-3 text-xl font-bold text-foreground">{title}</h3>
        <p className="text-muted-foreground flex-grow">{description}</p>

        <div
          className="mt-6 inline-flex items-center text-sm font-medium transition-colors"
          style={{ color: color }}
        >
          <span>Learn more</span>
          <svg
            className="ml-1 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Card effects */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(135deg, ${color}10, ${color}05)`,
          boxShadow: `inset 0 0 20px rgba(255, 255, 255, 0.5)`,
        }}
      ></div>

      <div
        className="absolute -bottom-1 -right-1 h-20 w-20 rounded-full blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-300"
        style={{ background: color }}
      ></div>
    </div>
  );
}
