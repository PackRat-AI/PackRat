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
import type { FeedReportReason } from '../types';

export const REPORT_REASONS = Object.freeze([
  'spam',
  'harassment',
  'inappropriate',
] as const satisfies readonly FeedReportReason[]);

/**
 * Asks why a post or comment is being reported — a Material 3 confirmation dialog with a radio
 * list, the same pattern as flagging a trail report.
 */
export function ReportReasonDialog({
  title,
  visible,
  onReport,
  onDismiss,
}: {
  title: string;
  visible: boolean;
  onReport: (reason: FeedReportReason) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<FeedReportReason | null>(null);

  if (!visible) return null;

  const labels = {
    spam: t('feed.reasonSpam'),
    harassment: t('feed.reasonHarassment'),
    inappropriate: t('feed.reasonInappropriate'),
  } as const;

  const close = () => {
    setReason(null);
    onDismiss();
  };

  return (
    <JCHost matchContents>
      <AlertDialog onDismissRequest={close}>
        <AlertDialog.Title>
          <JCText>{title}</JCText>
        </AlertDialog.Title>
        <AlertDialog.Text>
          <JCColumn modifiers={[selectableGroup()]}>
            {REPORT_REASONS.map((option) => (
              <JCRow
                key={option}
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 12 }}
                modifiers={[
                  fillMaxWidth(),
                  height(48),
                  selectable(reason === option, () => setReason(option), 'radioButton'),
                  testIDModifier(testIds.feed.reportReason(option)),
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
              onReport(picked);
            }}
          >
            <JCText>{t('feed.reportConfirm')}</JCText>
          </JCTextButton>
        </AlertDialog.ConfirmButton>
        <AlertDialog.DismissButton>
          <JCTextButton onClick={close}>
            <JCText>{t('feed.cancel')}</JCText>
          </JCTextButton>
        </AlertDialog.DismissButton>
      </AlertDialog>
    </JCHost>
  );
}
