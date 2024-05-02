import React from 'react';
import { RStack, RText } from '@packrat/ui';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link } from '@packrat/crosspath';
import { useCopyClipboard, useScreenWidth } from 'app/hooks/common';
import { useAuthUser } from 'app/auth/hooks';
import useTheme from '../../hooks/useTheme';

export const CustomCardHeader = ({ data, title, link, actionsComponent }) => {
  const { isCopied, handleCopyLink } = useCopyClipboard(link);
  const user = useAuthUser();
  const { isDark } = useTheme();

  return (
    <>
      <RStack style={{ flex: 1 }}>
        <RText>{title}</RText>
      </RStack>
      <View>
        <Link href={`/profile/${data.owner_id.id || data.owner_id}`}>
          <RText>
            {user?.id === data.owner_id
              ? 'Your Profile'
              : `View ${
                  data.owners && data.owners.length
                    ? data.owners[0].name
                    : 'Profile'
                }`}
          </RText>
        </Link>
      </View>
      {link && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isCopied ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons
                name="check"
                size={24}
                color="green"
                onPress={() => handleCopyLink(link)}
              />
              <RText color="green">Copied</RText>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons
                name="link"
                size={24}
                color={isDark ? 'white' : 'black'}
                onPress={() => handleCopyLink(link)}
              />
              <RText style={{ color: isDark ? 'white' : 'black' }}>Copy</RText>
            </View>
          )}
        </View>
      )}
      {actionsComponent}
    </>
  );
};
