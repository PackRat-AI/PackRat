import { cn } from '@packrat/web-ui/lib/utils';
import Image from 'next/image';

interface DeviceMockupProps {
  image: string;
  alt: string;
  className?: string;
  priority?: boolean;
  showShadow?: boolean;
  showReflection?: boolean;
  showGradient?: boolean;
  aspectRatio?: 'portrait' | 'landscape';
}

export default function DeviceMockup({
  image,
  alt,
  className,
  priority = false,
  showShadow = true,
  showReflection = true,
  showGradient = true,
  aspectRatio = 'portrait',
}: DeviceMockupProps) {
  return (
    <div
      className={cn(
        'group relative mx-auto w-full transition-all duration-500',
        aspectRatio === 'portrait' ? 'max-w-[280px] md:max-w-[320px]' : 'max-w-[560px] w-full',
        className,
      )}
    >
      {/* Glow effect */}
      <div
        className="absolute -inset-4 rounded-[60px] blur-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-500"
        style={{
          background: 'linear-gradient(45deg, hsl(var(--primary)), hsl(var(--secondary)))',
        }}
      />

      <div
        className={cn(
          'relative w-full overflow-hidden rounded-[40px] border-[14px] bg-black transition-transform duration-500 group-hover:scale-[1.02]',
          aspectRatio === 'portrait' ? 'aspect-[9/19.5]' : 'aspect-[16/9]',
          showShadow && 'shadow-2xl shadow-black/20',
        )}
        style={{ borderColor: 'var(--device-notch-color)' }}
      >
        {/* Notch */}
        {aspectRatio === 'portrait' && (
          <div className="absolute top-0 left-1/2 z-10 h-6 w-36 -translate-x-1/2 rounded-b-3xl bg-black"></div>
        )}

        {/* Screen content */}
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src={image || '/placeholder.svg'}
            alt={alt}
            fill
            className="object-cover object-top"
            priority={priority}
          />

          {/* Screen reflection overlay */}
          {showReflection && (
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-80"></div>
          )}

          {/* Screen gradient overlay */}
          {showGradient && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
          )}
        </div>

        {/* Animated screen glare */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 -translate-x-1/2 rotate-[15deg] transition-all duration-700 group-hover:opacity-40 group-hover:translate-x-1/2" />
      </div>
    </div>
  );
}
