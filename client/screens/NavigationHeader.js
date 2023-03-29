import { View, StyleSheet, Image, Text } from "react-native";

import { Link } from "expo-router";

import { Desktop, Tablet, Mobile } from "../media";
import { useAuth } from "../auth/provider";

import { theme } from "../theme";
import { Entypo } from "@expo/vector-icons";
import { FontAwesome } from "@expo/vector-icons";
import { EvilIcons } from "@expo/vector-icons";
import { AntDesign } from "@expo/vector-icons";
import { MaterialIcons } from "@expo/vector-icons";

import packratlogo from "../assets/packrat.png";
import { useState } from "react";

const MobileDropdown = ({ setIsMenuOpen }) => {
  const { signOut } = useAuth();
  return (
    <View
      style={{
        position: "absolute",
        right: 0,
        top: 25,
        backgroundColor: theme.colors.background,
        width: "150px",
        cursor: "pointer",
      }}
    >
      <View style={styles.mobileLink}>
        <AntDesign
          name="close"
          size={28}
          color={theme.colors.iconColor}
          onPress={() => setIsMenuOpen(false)}
        />
      </View>
      <Link href="/">
        <View style={styles.mobileLink}>
          <Entypo name="home" size={24} color={theme.colors.iconColor} />

          <Text>Home</Text>
        </View>
      </Link>
      <Link href="profile">
        <View style={styles.mobileLink}>
          <FontAwesome name="book" size={24} color={theme.colors.iconColor} />
          <Text>Profile</Text>
        </View>
      </Link>
      <Link href="/packs">
        <View style={styles.mobileLink}>
          <MaterialIcons
            name="backpack"
            size={24}
            color={theme.colors.iconColor}
          />

          <Text>Packs</Text>
        </View>
      </Link>
      <View style={styles.mobileLink}>
        <MaterialIcons name="logout" size={24} color={theme.colors.iconColor} />
        <Text style={{ color: "white" }} onPress={() => signOut()}>
          Logout
        </Text>
      </View>
    </View>
  );
};

const MutualContent = ({ desktopContainer, desktopNav, isMobile }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { signOut, user } = useAuth();

  return user ? (
    <View style={desktopContainer}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
        <Image
          style={isMobile ? styles.smallLogo : styles.logo}
          source={packratlogo}
        />
        <Text
          style={{
            color: theme.colors.text,
            fontSize: isMobile ? 28 : 48,
            fontWeight: 900,
          }}
        >
          PackRat
        </Text>
      </View>
      {isMobile ? (
        <EvilIcons
          name="navicon"
          size={48}
          color={theme.colors.iconColor}
          onPress={() => setIsMenuOpen(!isMenuOpen)}
        />
      ) : (
        <View style={desktopNav}>
          <Link href="/">
            <View style={isMobile ? styles.mobileLink : styles.link}>
              <Entypo name="home" size={24} color={theme.colors.iconColor} />
              <Text>Home</Text>
            </View>
          </Link>
          <Link href="profile">
            <View style={isMobile ? styles.mobileLink : styles.link}>
              <FontAwesome
                name="book"
                size={24}
                color={theme.colors.iconColor}
              />
              <Text>Profile</Text>
            </View>
          </Link>
          <Link href="/packs">
            <View style={isMobile ? styles.mobileLink : styles.link}>
              <MaterialIcons
                name="backpack"
                size={24}
                color={theme.colors.iconColor}
              />

              <Text>Packs</Text>
            </View>
          </Link>
          <View style={isMobile ? styles.mobileLink : styles.link}>
            <MaterialIcons
              name="logout"
              size={24}
              color={theme.colors.iconColor}
            />
            <Text style={{ color: "white" }} onPress={() => signOut()}>
              Logout
            </Text>
          </View>
        </View>
      )}
      {isMenuOpen ? <MobileDropdown setIsMenuOpen={setIsMenuOpen} /> : null}
    </View>
  ) : null;
};

export default function Navigation() {
  return (
    <View stye={{ width: "100%" }}>
      <Desktop>
        <MutualContent
          desktopContainer={styles.desktopContainer}
          desktopNav={styles.desktopNav}
        />
      </Desktop>
      <Tablet>
        <MutualContent
          desktopContainer={styles.mobileContainer}
          desktopNav={styles.desktopNav}
          isMobile={true}
        />
      </Tablet>
      <Mobile>
        <MutualContent
          desktopContainer={styles.mobileContainer}
          desktopNav={styles.desktopNav}
          isMobile={true}
        />
      </Mobile>
    </View>
  );
}

const styles = StyleSheet.create({
  mutualStyles: {
    backgroundColor: theme.colors.background,
    flex: 1,
    flexDirection: "row",
    height: "100%",
  },

  desktopContainer: {
    backgroundColor: theme.colors.background,
    width: "100",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingHorizontal: 90,
  },

  mobileContainer: {
    backgroundColor: theme.colors.background,
    width: "100",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 25,
    position: "relative",
    height: "300px",
  },

  desktopNav: {
    flexDirection: "row",
    gap: 15,
  },

  logo: {
    width: 160,
    height: 150,
  },
  smallLogo: {
    width: 100,
    height: 95,
  },

  mobileLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomColor: "white",
    borderBottomWidth: 1,
    width: "100%",
    color: "white",
  },

  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderColor: "white",
    borderWidth: 1,
    borderRadius: 6,
    cursor: "pointer",
    color: "white",
  },
});
