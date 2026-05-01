import { Minus, Plus } from 'lucide-react';

import { cn } from './cn.web';

type StepperButtonProps = {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

type StepperProps = {
  subtractButton?: StepperButtonProps;
  addButton?: StepperButtonProps;
  className?: string;
};

export function Stepper({ subtractButton, addButton, className }: StepperProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center overflow-hidden rounded-full border border-border',
        className,
      )}
    >
      <button
        type="button"
        onClick={subtractButton?.onClick}
        disabled={subtractButton?.disabled}
        className={cn(
          'flex h-9 w-10 items-center justify-center transition-colors hover:bg-accent disabled:opacity-50',
          subtractButton?.className,
        )}
      >
        <Minus size={16} />
      </button>
      <div className="h-6 w-px bg-border" />
      <button
        type="button"
        onClick={addButton?.onClick}
        disabled={addButton?.disabled}
        className={cn(
          'flex h-9 w-10 items-center justify-center transition-colors hover:bg-accent disabled:opacity-50',
          addButton?.className,
        )}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
