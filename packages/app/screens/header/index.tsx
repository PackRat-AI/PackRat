import { Navigation } from '../../components/navigation';
import ProgressBarComponent from 'app/components/progress';

export default function Header() {
  return (
    <>
      <Navigation />
      {/* Progress bar is causing some console errors */}
      {/* <ProgressBarComponent /> */}
    </>
  );
}
