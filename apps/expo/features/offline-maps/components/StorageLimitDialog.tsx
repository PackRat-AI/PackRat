import {
  AlertDialog,
  Column as JCColumn,
  RadioButton as JCRadioButton,
  Row as JCRow,
  Text as JCText,
  TextButton as JCTextButton,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  height,
  selectable,
  selectableGroup,
} from '@expo/ui/jetpack-compose/modifiers';
import { ThemedHost as JCHost } from '@packrat/ui/src/themed-host';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useState } from 'react';
import { formatBytes, STORAGE_LIMIT_CHOICES } from '../utils/offlineArea';

export function storageLimitLabel({ bytes, noLimit }: { bytes: number; noLimit: string }): string {
  return bytes === 0 ? noLimit : formatBytes(bytes);
}

/** The storage limit as an MD3 radio-list dialog, the pattern for picking one of several options. */
export function StorageLimitDialog({
  value,
  onChange,
  onDismiss,
}: {
  value: number;
  onChange: (bytes: number) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [choice, setChoice] = useState(value);

  return (
    <JCHost matchContents>
      <AlertDialog onDismissRequest={onDismiss}>
        <AlertDialog.Title>
          <JCText>{t('offlineMaps.storageLimit')}</JCText>
        </AlertDialog.Title>
        <AlertDialog.Text>
          <JCColumn modifiers={[selectableGroup()]}>
            {STORAGE_LIMIT_CHOICES.map((bytes) => (
              <JCRow
                key={bytes}
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 12 }}
                modifiers={[
                  fillMaxWidth(),
                  height(48),
                  selectable(choice === bytes, () => setChoice(bytes), 'radioButton'),
                ]}
              >
                <JCRadioButton selected={choice === bytes} />
                <JCText>{storageLimitLabel({ bytes, noLimit: t('offlineMaps.noLimit') })}</JCText>
              </JCRow>
            ))}
          </JCColumn>
        </AlertDialog.Text>
        <AlertDialog.ConfirmButton>
          <JCTextButton onClick={() => onChange(choice)}>
            <JCText>{t('common.ok')}</JCText>
          </JCTextButton>
        </AlertDialog.ConfirmButton>
        <AlertDialog.DismissButton>
          <JCTextButton onClick={onDismiss}>
            <JCText>{t('common.cancel')}</JCText>
          </JCTextButton>
        </AlertDialog.DismissButton>
      </AlertDialog>
    </JCHost>
  );
}
