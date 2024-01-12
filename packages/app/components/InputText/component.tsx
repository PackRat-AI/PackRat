import { RInput, RLabel } from '@packrat/ui';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { type TextInput } from 'react-native';
import { type InputTextProps, type InputTextRef } from './props';

export const InputText: React.ForwardRefExoticComponent<InputTextProps> =
  forwardRef<InputTextRef, InputTextProps>((props, ref) => {
    const {
      label,
      placeholder,
      isDisabled = false,
      autoFocus = false,
      maxLength,
      name = 'input',
      rules = { required: false },
      keyboardType = 'default',
      secureTextEntry = false,
      ...rest
    } = props;

    let { control = undefined } = props;

    const inputRef = useRef<TextInput>(null);
    useImperativeHandle(ref, () => ({
      /**
       * Focuses on the input element.
       * @return {void}
       */
      focus: () => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      },
    }));

    const { control: formControl } = useForm();

    if (!control) {
      control = formControl;
    }

    return (
      <Controller
        control={control}
        name={name}
        rules={rules}
        render={({
          field: { value, onChange, onBlur },
          fieldState: { error },
        }) => (
          <>
            <RLabel>{label}</RLabel>
            <RInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              underlineColorAndroid="transparent"
              allowFontScaling={false}
              autoComplete={
                keyboardType === 'email-address' ? 'email' : undefined
              }
              textContentType={
                keyboardType === 'email-address' ? 'emailAddress' : undefined
              }
              autoCorrect={false}
              autoCapitalize={
                keyboardType === 'email-address' ? 'none' : 'sentences'
              }
              editable={!isDisabled}
              keyboardType={keyboardType}
              maxLength={maxLength}
              numberOfLines={1}
              autoFocus={autoFocus}
              placeholder={placeholder}
              secureTextEntry={secureTextEntry}
              ref={inputRef}
              {...rest}
            />
          </>
        )}
      />
    );
  });
