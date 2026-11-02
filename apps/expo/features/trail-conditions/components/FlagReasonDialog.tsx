import {
  AlertDialog,
  Column as JCColumn,
  Host as JCHost,
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
  testID as testIDModifier,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useState } from 'react';
import type { TrailConditionFlagReason } from '../types';

export const FLAG_REASONS = Object.freeze([
  'inaccurate',
  'offensive',
  'spam',
] as const satisfies readonly TrailConditionFlagReason[]);

interface FlagReasonDialogProps {
  visible: boolean;
  onFlag: (reason: TrailConditionFlagReason) => void;
  onDismiss: () => void;
}

/**
 * Asks why a report is being flagged — a Material 3 confirmation dialog with a radio list, the
 * pattern M3 gives for picking one option before committing. The Swift app asks the same three
 * reasons in a confirmation dialog.
 */
export function FlagReasonDialog({ visible, onFlag, onDismiss }: FlagReasonDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<TrailConditionFlagReason | null>(null);

  if (!visible) return null;

  const labels = {
    inaccurate: t('trailConditions.flagReasonInaccurate'),
    offensive: t('trailConditions.flagReasonOffensive'),
    spam: t('trailConditions.flagReasonSpam'),
  } as const;

  const close = () => {
    setReason(null);
    onDismiss();
  };

  return (
    <JCHost matchContents>
      <AlertDialog onDismissRequest={close}>
        <AlertDialog.Title>
          <JCText>{t('trailConditions.flagReport')}</JCText>
        </AlertDialog.Title>
        <AlertDialog.Text>
          <JCColumn modifiers={[selectableGroup()]}>
            {FLAG_REASONS.map((option) => (
              <JCRow
                key={option}
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 12 }}
                modifiers={[
                  fillMaxWidth(),
                  height(48),
                  selectable(reason === option, () => setReason(option), 'radioButton'),
                  testIDModifier(testIds.trailConditions.flagReason(option)),
                ]}
              >
                <JCRadioButton selected={reason === option} />
                <JCText>{labels[option]}</JCText>
              </JCRow>
            ))}
          </JCColumn>
        </AlertDialog.Text>
        <AlertDialog.ConfirmButton>
          <JCTextButton
            enabled={reason !== null}
            onClick={() => {
              if (!reason) return;
              const picked = reason;
              setReason(null);
              onFlag(picked);
            }}
          >
            <JCText>{t('trailConditions.flagConfirm')}</JCText>
          </JCTextButton>
        </AlertDialog.ConfirmButton>
        <AlertDialog.DismissButton>
          <JCTextButton onClick={close}>
            <JCText>{t('common.cancel')}</JCText>
          </JCTextButton>
        </AlertDialog.DismissButton>
      </AlertDialog>
    </JCHost>
  );
}
