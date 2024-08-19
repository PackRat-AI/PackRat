/* eslint-disable react/prop-types */
/* eslint-disable react/react-in-jsx-scope */
import { useState } from 'react';
import { RText as OriginalRText, RStack } from '@packrat/ui';
import { RLink } from '@packrat/ui';
import { type LayoutChangeEvent, View } from 'react-native';
import useCustomStyles from 'app/hooks/useCustomStyles';
import loadStyles from './feedpreview.style';
import { AntDesign, Fontisto, MaterialIcons } from '@expo/vector-icons';
import useTheme from 'app/hooks/useTheme';
import { useItemWeightUnit } from 'app/modules/item';
import { convertWeight } from 'app/utils/convertWeight';
import { formatNumber } from 'app/utils/formatNumber';
import { hexToRGBA } from 'app/utils/colorFunctions';

// TODO FeedItem is one of: trip, pack, similar pack & item
export type FeedItem = any;

interface FeedPreviewCardProps {
  linkStr: string;
  item: FeedItem;
  feedType: string;
}

const RText: any = OriginalRText;

const FeedPreviewCard: React.FC<FeedPreviewCardProps> = ({
  linkStr,
  item,
  feedType,
}) => {
  const { currentTheme } = useTheme();
  const styles = useCustomStyles(loadStyles);
  const [weightUnit] = useItemWeightUnit();
  const formattedWeight = convertWeight(
    item.total_weight ?? item.weight,
    item.unit ?? 'g',
    weightUnit,
  );
  const [cardWidth, setCardWidth] = useState<number | undefined>();

  const handleSetCardWidth = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setCardWidth(width);
  };

  if (feedType == 'similarItems') {
    return (
      <View style={styles.cardStyles}>
        <View
          style={{
            backgroundColor: currentTheme.colors.cardIconColor,
            width: '100%',
            paddingLeft: 16,
            alignSelf: 'stretch',
          }}
        >
          <View
            style={{
              backgroundColor: currentTheme.colors.primary,
              padding: 4,
              alignSelf: 'flex-start',
              borderRadius: 8,
              position: 'relative',
              top: 16,
            }}
          >
            <Fontisto
              name="tent"
              size={24}
              color={currentTheme.colors.cardIconColor}
            />
          </View>
        </View>
        <View style={{ padding: 16 }}>
          <RText style={[styles.feedItemTitle, { width: cardWidth }]}>
            {item.name}
          </RText>
          <RStack
            style={{
              flexDirection: 'row',
              alignItems: 'start',
              fontWeight: 500,
            }}
            gap="$6"
            onLayout={handleSetCardWidth}
          >
            <RText
              color={hexToRGBA(currentTheme.colors.text, 0.8)}
              style={{ fontWeight: 'bold', lineHeight: 'normal' }}
            >
              {formatNumber(formattedWeight)}
              {weightUnit}
            </RText>

            <RText
              color={hexToRGBA(currentTheme.colors.text, 0.8)}
              style={{ fontWeight: 'bold', lineHeight: 'normal' }}
            >
              Qty: {item.quantity}
            </RText>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AntDesign
                name="clockcircle"
                size={16}
                color={hexToRGBA(currentTheme.colors.text, 0.8)}
              />
              <RText
                color={hexToRGBA(currentTheme.colors.text, 0.8)}
                style={{ fontWeight: 'bold', lineHeight: 'normal' }}
              >
                {new Date(item.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: '2-digit',
                  ...(new Date(item.createdAt).getFullYear() ==
                  new Date().getFullYear()
                    ? {}
                    : { year: 'numeric' }),
                })}
              </RText>
            </View>
          </RStack>
        </View>
      </View>
    );
  }

  return (
    <RLink href={linkStr}>
      <View style={styles.cardStyles}>
        <View
          style={{
            backgroundColor: currentTheme.colors.secondaryBlue,
            width: '100%',
            paddingLeft: 16,
            alignSelf: 'stretch',
          }}
        >
          <View
            style={{
              backgroundColor: currentTheme.colors.border,
              padding: 4,
              alignSelf: 'flex-start',
              borderRadius: 8,
              position: 'relative',
              top: 16,
            }}
          >
            <MaterialIcons
              name="backpack"
              size={24}
              color={currentTheme.colors.tertiaryBlue}
            />
          </View>
        </View>
        <View style={{ padding: 16 }}>
          <RText style={[styles.feedItemTitle, { width: cardWidth }]}>
            {item.name}
          </RText>
          <RStack
            style={{
              flexDirection: 'row',
              alignItems: 'start',
              fontWeight: 500,
            }}
            gap="$4"
            onLayout={handleSetCardWidth}
          >
            <RText
              color={hexToRGBA(currentTheme.colors.text, 0.8)}
              style={{ fontWeight: 'bold' }}
            >
              {formatNumber(formattedWeight)}
              {weightUnit}
            </RText>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AntDesign
                name="heart"
                size={16}
                color={hexToRGBA(currentTheme.colors.text, 0.8)}
              />
              <RText
                color={hexToRGBA(currentTheme.colors.text, 0.8)}
                style={{ fontWeight: 'bold' }}
              >
                {item.favorites_count}
              </RText>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AntDesign
                name="clockcircle"
                size={16}
                color={hexToRGBA(currentTheme.colors.text, 0.8)}
              />
              <RText
                color={hexToRGBA(currentTheme.colors.text, 0.8)}
                style={{ fontWeight: 'bold' }}
              >
                {new Date(item.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: '2-digit',
                  ...(new Date(item.createdAt).getFullYear() ==
                  new Date().getFullYear()
                    ? {}
                    : { year: 'numeric' }),
                })}
              </RText>
            </View>
            <RText
              color={hexToRGBA(currentTheme.colors.text, 0.8)}
              style={{ fontWeight: 'bold' }}
            >
              Ttl Score: {item.total_score}
            </RText>
          </RStack>
        </View>
      </View>
    </RLink>
  );
};

export default FeedPreviewCard;
