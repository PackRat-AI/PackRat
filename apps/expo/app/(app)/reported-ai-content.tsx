import ReportedContentScreen from 'expo-app/features/ai/screens/ReportedContentScreen';
import { ProGate } from 'expo-app/features/purchases';

export default function ReportedContentRoute() {
  return (
    <ProGate>
      <ReportedContentScreen />
    </ProGate>
  );
}
