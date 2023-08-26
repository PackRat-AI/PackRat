// FeedPreview.js

import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Card, Text, HStack, Badge } from "native-base";
import { Link } from "expo-router";
import { StyleSheet } from "react-native";
import { getPublicPacks, getPublicTrips } from "../../store/feedStore";
import { theme } from "../../theme";
import UseTheme from '../../hooks/useTheme';
import Carousel from '../carousel'

const FeedPreviewScroll = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getPublicPacks());
    dispatch(getPublicTrips());
  }, []);

  const feedData = useSelector((state) => state.feed);
  const filteredFeedData = feedData.publicTrips.concat(feedData.publicPacks);

  return (
    <Carousel itemWidth={250}>
      {filteredFeedData.map((item, index) => {
        const linkStr = `/${item.type}/${item._id}`;
        return linkStr ? (
          <Link href={linkStr} key={`${linkStr}`}>
            <Card key={index} style={styles().feedItem}>
              <HStack justifyContent="space-between">
                <Text style={styles().feedItemTitle}>{item.name}</Text>
                <Badge colorScheme="info" textTransform={"capitalize"}>
                  {item.type}
                </Badge>
              </HStack>
              <Text>{item.description}</Text>
            </View>
          </Link>
        ) : null;
      })}
    </Carousel>
  );
};


const FeedPreview = () => {
  return <FeedPreviewScroll />;
};

const styles = () => {
  const { enableDarkMode, enableLightMode, isDark, isLight, currentTheme } = UseTheme();
  return StyleSheet.create({
    feedPreview: {
      flexDirection: "row",
      width: "100%",
      marginBottom: 20,
    },
    feedItem: {
      width: 250,
      height: 100,
      backgroundColor: currentTheme.colors.primary,
      marginBottom: 10,
      padding: 10,
      borderRadius: 5,
      marginRight: 10,
      marginLeft: 10,
    },
    feedItemTitle: {
      fontWeight: "bold",
      fontSize: 16,
      color: currentTheme.colors.text,
      marginBottom: 5,
    },
  });
}

export default FeedPreviewScroll;
