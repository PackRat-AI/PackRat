import { type ClassValue, clsx } from 'clsx';
import { forwardRef, useId } from 'react';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TextFieldProps = {
  value?: string;
  onChangeText?: (text: string) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onBlur?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  label?: string;
  errorMessage?: string;
  leftView?: React.ReactNode;
  rightView?: React.ReactNode;
  multiline?: boolean;
  numberOfLines?: number;
  autoFocus?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: string;
  autoCapitalize?: string;
  autoCorrect?: boolean;
  editable?: boolean;
  maxLength?: number;
  testID?: string;
  className?: string;
  containerClassName?: string;
  // RN-specific props we ignore on web
  textAlignVertical?: string;
  onLayout?: unknown;
  containerTestID?: string;
  containerAccessibilityLabel?: string;
  materialVariant?: string;
  materialRingColor?: string;
  materialHideActionIcons?: boolean;
  labelClassName?: string;
  errorMessage?: string;
  inputMode?: string;
  returnKeyType?: string;
  onSubmitEditing?: () => void;
  style?: React.CSSProperties;
};

export const TextField = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextFieldProps>(
  (
    {
      value,
      onChangeText,
      onChange,
      onBlur,
      onFocus,
      placeholder,
      label,
      errorMessage,
      leftView,
      rightView,
      multiline,
      numberOfLines = 3,
      autoFocus,
      secureTextEntry,
      editable = true,
      maxLength,
      testID,
      className,
      containerClassName,
    },
    ref,
  ) => {
    const fieldId = useId();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChangeText?.(e.target.value);
      onChange?.(e);
    };

    const shared = {
      value: value ?? '',
      onChange: handleChange,
      onBlur,
      onFocus,
      placeholder,
      autoFocus,
      maxLength,
      disabled: editable === false,
      'data-testid': testID,
      className: cn(
        'flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground',
        className,
      ),
    };

    return (
      <div className={cn('w-full', containerClassName)}>
        {label && (
          <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
            errorMessage && 'border-destructive',
          )}
        >
          {leftView}
          {multiline ? (
            <textarea
              {...shared}
              id={fieldId}
              ref={ref as React.Ref<HTMLTextAreaElement>}
              rows={numberOfLines}
              className={cn(shared.className, 'resize-none')}
            />
          ) : (
            <input
              {...shared}
              id={fieldId}
              ref={ref as React.Ref<HTMLInputElement>}
              type={secureTextEntry ? 'password' : 'text'}
            />
          )}
          {rightView}
        </div>
        {errorMessage && <p className="mt-1 text-xs text-destructive">{errorMessage}</p>}
      </div>
    );
  },
);
TextField.displayName = 'TextField';
