import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { createDropdownItem } from '@packrat/ui/src/dropdown-menu';
import { useAuthState } from 'expo-app/features/auth/hooks/useAuthState';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRef, useState } from 'react';
import { FlagReasonDialog } from '../components/FlagReasonDialog';
import type { SignedReport } from '../utils/trails';
import {
  useBlockReportAuthor,
  useDeleteTrailConditionReport,
  useFlagTrailConditionReport,
} from './useTrailConditions';

/**
 * What the hiker can do with a report — `TrailReportModeration` in the Swift app. The author can
 * delete their own report; anyone else can flag it for review or block its author, from a
 * Material 3 overflow menu. Every confirmation and result is a Material 3 dialog. Flagging and
 * blocking both hide the report at once, so `onHidden` leaves the screen.
 *
 * Render `dialogs` once in the screen body: the header is drawn by the navigator, outside it.
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
  const alertRef = useRef<AlertMethods>(null);
  const [isFlagging, setIsFlagging] = useState(false);
  const flag = useFlagTrailConditionReport();
  const block = useBlockReportAuthor();
  const remove = useDeleteTrailConditionReport();

  const isOwn = report?.userId != null && user?.id != null && String(user.id) === report.userId;
  const hikerName = report?.authorName ?? t('trailConditions.thisHiker');
  const isBusy = flag.isPending || block.isPending || remove.isPending;

  const tell = ({ title, message, onOk }: { title: string; message: string; onOk?: () => void }) =>
    alertRef.current?.alert({ title, message, buttons: [{ text: t('common.ok'), onPress: onOk }] });

  const confirmDelete = () => {
    if (!report) return;
    alertRef.current?.alert({
      title: t('trailConditions.deleteReportTitle'),
      message: t('trailConditions.deleteReportMessage'),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () =>
            remove.mutate(report.id, {
              onSuccess: onHidden,
              onError: () =>
                tell({
                  title: t('trailConditions.deleteFailedTitle'),
                  message: t('trailConditions.somethingWentWrong'),
                }),
            }),
        },
      ],
    });
  };

  const confirmBlock = () => {
    const authorId = report?.userId;
    if (!authorId) return;
    alertRef.current?.alert({
      title: t('trailConditions.blockAuthorTitle', { name: hikerName }),
      message: t('trailConditions.blockAuthorMessage'),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('trailConditions.blockConfirm'),
          style: 'destructive',
          onPress: () =>
            block.mutate(authorId, {
              onSuccess: () =>
                tell({
                  title: t('trailConditions.blockedTitle', { name: hikerName }),
                  message: t('trailConditions.blockedMessage'),
                  onOk: onHidden,
                }),
              onError: () =>
                tell({
                  title: t('trailConditions.blockFailedTitle', { name: hikerName }),
                  message: t('trailConditions.somethingWentWrong'),
                }),
            }),
        },
      ],
    });
  };

  const menuItems = [
    createDropdownItem({ actionKey: 'flag', title: t('trailConditions.flagReport') }),
    ...(report?.userId
      ? [
          createDropdownItem({
            actionKey: 'block',
            title: t('trailConditions.blockAuthor', { name: hikerName }),
            destructive: true,
          }),
        ]
      : []),
  ];

  const onMenuItemPress = ({ actionKey }: { actionKey: string }) => {
    if (actionKey === 'flag') setIsFlagging(true);
    else if (actionKey === 'block') confirmBlock();
  };

  const dialogs = (
    <>
      <Alert ref={alertRef} title="" buttons={[]} />
      <FlagReasonDialog
        visible={isFlagging}
        onDismiss={() => setIsFlagging(false)}
        onFlag={(reason) => {
          setIsFlagging(false);
          if (!report) return;
          flag.mutate(
            { id: report.id, reason },
            {
              onSuccess: () =>
                tell({
                  title: t('trailConditions.flagThanksTitle'),
                  message: t('trailConditions.flagThanksMessage'),
                  onOk: onHidden,
                }),
              onError: () =>
                tell({
                  title: t('trailConditions.flagFailedTitle'),
                  message: t('trailConditions.somethingWentWrong'),
                }),
            },
          );
        }}
      />
    </>
  );

  return { isOwn, isBusy, confirmDelete, menuItems, onMenuItemPress, dialogs };
}
