import { useActionSheet } from '@expo/react-native-action-sheet';
import { useAuthState } from 'expo-app/features/auth/hooks/useAuthState';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Alert } from 'react-native';
import type { TrailConditionFlagReason } from '../types';
import type { SignedReport } from '../utils/trails';
import {
  useBlockReportAuthor,
  useDeleteTrailConditionReport,
  useFlagTrailConditionReport,
} from './useTrailConditions';

const FLAG_REASONS = Object.freeze([
  'inaccurate',
  'offensive',
  'spam',
] as const satisfies readonly TrailConditionFlagReason[]);

/**
 * The More menu on a report — `TrailReportModeration` in the Swift app. The author can delete
 * their own report; anyone else can flag it for review or block its author. Flagging and
 * blocking both hide the report from the hiker at once, so `onHidden` leaves the screen.
 */
export function useReportActions({
  report,
  onHidden,
}: {
  report: SignedReport | undefined;
  onHidden: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuthState();
  const { showActionSheetWithOptions } = useActionSheet();
  const flag = useFlagTrailConditionReport();
  const block = useBlockReportAuthor();
  const remove = useDeleteTrailConditionReport();

  const isOwn = report?.userId != null && user?.id != null && String(user.id) === report.userId;
  const hikerName = report?.authorName ?? t('trailConditions.thisHiker');
  const isBusy = flag.isPending || block.isPending || remove.isPending;

  const showFailure = (title: string) =>
    Alert.alert(title, t('trailConditions.somethingWentWrong'));

  const confirmDelete = (id: string) => {
    Alert.alert(t('trailConditions.deleteReportTitle'), t('trailConditions.deleteReportMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          remove.mutate(id, {
            onSuccess: onHidden,
            onError: () => showFailure(t('trailConditions.deleteFailedTitle')),
          }),
      },
    ]);
  };

  const chooseFlagReason = (id: string) => {
    const labels = {
      inaccurate: t('trailConditions.flagReasonInaccurate'),
      offensive: t('trailConditions.flagReasonOffensive'),
      spam: t('trailConditions.flagReasonSpam'),
    } as const;
    const options = [...FLAG_REASONS.map((reason) => labels[reason]), t('common.cancel')];
    showActionSheetWithOptions(
      { title: t('trailConditions.flagReport'), options, cancelButtonIndex: FLAG_REASONS.length },
      (index) => {
        const reason = index === undefined ? undefined : FLAG_REASONS[index];
        if (!reason) return;
        flag.mutate(
          { id, reason },
          {
            onSuccess: () =>
              Alert.alert(
                t('trailConditions.flagThanksTitle'),
                t('trailConditions.flagThanksMessage'),
                [{ text: t('common.ok'), onPress: onHidden }],
              ),
            onError: () => showFailure(t('trailConditions.flagFailedTitle')),
          },
        );
      },
    );
  };

  const confirmBlock = (userId: string) => {
    Alert.alert(
      t('trailConditions.blockAuthorTitle', { name: hikerName }),
      t('trailConditions.blockAuthorMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('trailConditions.blockConfirm'),
          style: 'destructive',
          onPress: () =>
            block.mutate(userId, {
              onSuccess: () =>
                Alert.alert(
                  t('trailConditions.blockedTitle', { name: hikerName }),
                  t('trailConditions.blockedMessage'),
                  [{ text: t('common.ok'), onPress: onHidden }],
                ),
              onError: () =>
                showFailure(t('trailConditions.blockFailedTitle', { name: hikerName })),
            }),
        },
      ],
    );
  };

  /** Opens the menu. Null when there is nothing the hiker can do with this report. */
  const open =
    report == null
      ? null
      : () => {
          if (isOwn) {
            confirmDelete(report.id);
            return;
          }
          const authorId = report.userId;
          const options = [
            t('trailConditions.flagReport'),
            ...(authorId ? [t('trailConditions.blockAuthor', { name: hikerName })] : []),
            t('common.cancel'),
          ];
          showActionSheetWithOptions(
            { options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: 1 },
            (index) => {
              if (index === 0) chooseFlagReason(report.id);
              else if (index === 1 && authorId) confirmBlock(authorId);
            },
          );
        };

  return { open, isOwn, isBusy };
}
