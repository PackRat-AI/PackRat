import { ActivityIndicator as RNActivityIndicator, type ActivityIndicatorProps } from 'react-native';
import { cn } from '../utils';

export interface ActivityIndicatorPropsExtended extends Omit<ActivityIndicatorProps, 'color'> {
  /**
   * Optional className for additional styling
   */
  className?: string;
  /**
   * Color variant
   */
  variant?: 'primary' | 'secondary' | 'white';
}

export function ActivityIndicator({
  variant = 'primary',
  className,
  ...props
}: ActivityIndicatorPropsExtended) {
  const colorMap = {
    primary: '#0ea5e9',
    secondary: '#64748b',
    white: '#ffffff',
  };

  return (
    <RNActivityIndicator
      className={className}
      color={colorMap[variant]}
      {...props}
    />
  );
}
