import { use$ } from '@legendapp/state/react';
import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { FullScreenDialogHeader } from 'expo-app/features/trip-stats/components/DialogParts';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateTimeField } from '../components/DateTimeField';
import { extendSafetyCheckIn } from '../lib/safetyActions';
import { safetyStore } from '../store/safetyCheckIn';
import { extendedReturn } from '../utils/safetyCheckIn';

const QUICK_HOURS = Object.freeze([1, 2, 4] as const);

/** Pushes the expected return back; the contacts are told the new time. */
export function RunningLateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const checkIn = use$(() => safetyStore.active.get()[id]);
  const current = checkIn ? new Date(checkIn.expectedReturnAt) : new Date();
  const [newReturn, setNewReturn] = useState(() =>
    extendedReturn({ current, now: new Date(), hours: 2 }),
  );

  const save = () => {
    extendSafetyCheckIn({ tripId: id, to: newReturn });
    router.back();
  };

  return (
    <View className="flex-1 bg-background">
      <FullScreenDialogHeader
        title={t('safetyCheckIn.late.title')}
        onClose={() => router.back()}
        onSave={save}
        canSave={Boolean(checkIn) && newReturn > new Date()}
        saveLabel={t('safetyCheckIn.late.update')}
        saveTestID={testIds.safetyCheckIn.runningLateSaveBtn}
      />
      <SafeAreaView edges={['bottom']} className="gap-2 pt-2">
        <DateTimeField
          label={t('safetyCheckIn.late.backBy')}
          value={newReturn}
          onChange={setNewReturn}
          minimumDate={new Date()}
          testID={testIds.safetyCheckIn.runningLatePicker}
        />
        <View className="flex-row gap-2 px-4">
          {QUICK_HOURS.map((hours) => (
            <Button
              key={hours}
              variant="outlined"
              size="sm"
              onPress={() => setNewReturn(extendedReturn({ current, now: new Date(), hours }))}
              testID={testIds.safetyCheckIn.runningLateQuick(hours)}
            >
              <Text>{t('safetyCheckIn.late.plusHours', { count: hours })}</Text>
            </Button>
          ))}
        </View>
        <Text variant="footnote" className="px-4 pt-2 text-muted-foreground" wrap>
          {t('safetyCheckIn.late.explainer')}
        </Text>
      </SafeAreaView>
    </View>
  );
}
