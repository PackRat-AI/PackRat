import React from 'react';
import { RStack, RText as OriginalRText, RButton } from '@packrat/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform, View } from 'react-native';
import useTheme from '../../hooks/useTheme';
import { useAuthUser } from 'app/auth/hooks';
import { useRouter } from 'app/hooks/router';
import { first } from 'lodash';
import useCustomStyles from 'app/hooks/useCustomStyles';
import { PlacesAutocomplete } from 'app/components/PlacesAutocomplete/PlacesAutocomplete';

const RText: any = OriginalRText;

interface HeroSectionProps {
  onSelect?: (selectedResult: SearchResult) => void;
  style?: any;
}

interface SearchResult {
  properties: {
    osm_id: number;
    osm_type: string;
    name: string;
  };
  geometry: {
    coordinates: [number, number];
  };
}

const HeroSection: React.FC<HeroSectionProps> = ({ onSelect }) => {
  const { currentTheme } = useTheme();
  const styles = useCustomStyles(loadStyles);
  const router = useRouter();

  const handleSearchSelect = async (selectedResult: SearchResult) => {
    try {
      const { osm_id, osm_type, name } = selectedResult.properties;

      if (!osm_id || !osm_type) {
        console.error(
          'No OSM ID or OSM type found in the selected search result',
        );
      } else {
        router.push({
          pathname: '/destination/query',
          query: {
            osmType: osm_type,
            osmId: osm_id,
            name,
          },
        });
      }
    } catch (error) {
      console.error('error', error);
    }
  };

  const user = useAuthUser();
  const firstNameOrUser = first(user?.name?.split(' ')) ?? 'User';
  const bannerText =
    firstNameOrUser !== 'User'
      ? `Let's find a new trail, ${firstNameOrUser}`
      : "Let's find a new trail";

  return (
    <View style={styles.banner}>
      <RStack style={styles.stack}>
        <RText style={styles.title}>{bannerText}</RText>
        {Platform.OS === 'web' ? (
          <View style={styles.searchContainer}>
            <PlacesAutocomplete
              onSelect={handleSearchSelect}
              placeholder={'Search by park, city, or trail'}
              style={styles.searchBar}
            />
          </View>
        ) : (
          <RButton
            style={styles.searchButton}
            onPress={() => {
              router.push('/search');
            }}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={24}
              color={currentTheme.colors.iconColor}
            />
            <RText color={currentTheme.colors.text} opacity={0.6}>
              Search by park, city, or trail
            </RText>
          </RButton>
        )}
      </RStack>
    </View>
  );
};

const loadStyles = (theme: any) => {
  const { currentTheme } = theme;
  return {
    banner: {
      width: '100%',
      padding: 20,
      backgroundColor: currentTheme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      zIndex: 1,
    },
    stack: {
      width: '100%',
      alignItems: 'flex-start', // Align items to the start (left)
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: currentTheme.colors.tertiaryBlue,
      textAlign: 'left', // Align text to the left
      width: '100%', // Ensure it takes full width for left alignment
    },
    searchContainer: {
      width: '100%',
      alignItems: 'flex-start',
    },
    searchBar: {
      width: '100%',
      padding: 10,
      borderRadius: 5,
      backgroundColor: currentTheme.colors.inputBackground,
      color: currentTheme.colors.text,
      borderWidth: 0,
      elevation: 0,
      shadowOpacity: 0,
    },
    searchButton: {
      backgroundColor: currentTheme.colors.border,
      minWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderRadius: 5,
    },
  };
};

export default HeroSection;
