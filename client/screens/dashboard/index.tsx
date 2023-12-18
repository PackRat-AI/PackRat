import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { VStack, Box, ScrollView } from 'native-base';
import { theme } from '../../theme';
import useTheme from '../../hooks/useTheme';
import HeroBanner from '../../components/dashboard/HeroBanner';
import QuickActionsSection from '../../components/dashboard/QuickActionSection';
import FeedPreview from '../../components/dashboard/FeedPreview';
import Section from '../../components/dashboard/Section';
import SectionHeader from '../../components/dashboard/SectionHeader';
import useCustomStyles from '~/hooks/useCustomStyles';

//tamagui
import { RScrollView, YStack, RStack} from '@packrat/ui';

const Dashboard = () => {
  const styles = useCustomStyles(loadStyles);
  
  return (
    <>
      <RScrollView contentContainerStyle={styles.content} horizontal={false}>
        <YStack f={1} fg={1} w='100%' mih={Platform.OS === 'web' ? '100vh' : null}>
            <RStack>
              <HeroBanner style={styles.cardContainer} />
              
              <Section>
                <SectionHeader
                  iconName="add-circle-outline"
                  text="Quick Actions"
                />
                <QuickActionsSection />
              </Section>
              <Section>
                <SectionHeader iconName="newspaper-outline" text="Feed" />
                <FeedPreview />
              </Section>
            </RStack>
        </YStack>
      </RScrollView>
    </>
  );
};

const loadStyles = (theme) => {
  const { currentTheme } = theme;
  return {
    container: {
      flex: 1,
      flexGrow: 1,
      backgroundColor: currentTheme.colors.background,
      width: '100%',
    },
    content: {
      flexGrow: 1,
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      paddingHorizontal: 20,
    },
    cardContainer: {
      flexDirection: 'column',
      justifyContent: 'space-between',
      marginBottom: 20,
      width: '100%',
    },
  };
};

export default Dashboard;
