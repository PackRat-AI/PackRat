import { RStack } from '@packrat/ui';
import QuickActionButton from './QuickActionButton';
import useCustomStyles from '~/hooks/useCustomStyles';
import { useQuickActions } from '~/hooks/dashboard';

const QuickActionsSection = () => {
  const styles = useCustomStyles(loadStyles);
  const { handleActionSelect, quickActionData } = useQuickActions();

  return (
    <RStack style={{ flexDirection: 'row', ...styles.section }}>
      {quickActionData.map((action) => (
        <QuickActionButton
          key={action.action}
          onPress={() => {
            handleActionSelect(action.action);
          }}
          iconName={action.iconName}
          text={action.text}
        />
      ))}
    </RStack>
  );
};

const loadStyles = (theme) => {
  const { currentTheme } = theme;
  return {
    section: {
      marginBottom: 20,
      paddingHorizontal: 20, // Added padding here.
    },
    card: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 20,
      backgroundColor: currentTheme.colors.secondaryBlue,
    },
  };
};
export default QuickActionsSection;
