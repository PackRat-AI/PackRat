import { StyleSheet } from "react-native";
import { Box, Input, Button, Text } from "native-base";
import { Platform } from "react-native";

import useAddPack from "../../hooks/useAddPack";
import { theme } from "../../theme";
import { useState } from "react";
// import { useAuth } from "../../auth/provider";
import { useSelector } from "react-redux";

export const AddPack = () => {
  const [name, setName] = useState("");

  const { addPack } = useAddPack();
  // const { user } = useAuth();
  const user = useSelector((state) => state.auth.user);

  return (
    <Box style={styles.mobileStyle}>
      <Input
        size="lg"
        variant="outline"
        placeholder="Name"
        value={name}
        onChangeText={(text) => setName(text)}
        width={Platform.OS === "web" ? "25%" : "100%"}
      />

      <Button
        width={Platform.OS === "web" ? null : "50%"}
        onPress={() => {
          addPack.mutate({ name, owner_id: user?._id });
          setName("");
        }}
      >
        <Text style={{ color: theme.colors.text }}>
          {addPack.isLoading ? "Loading..." : "Add Pack"}
        </Text>
      </Button>

      {addPack.isError && <Text>Pack already exists</Text>}
    </Box>
  );
};

const styles = StyleSheet.create({
  desktopStyle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 25,
    gap: 5,
    flex: 1,
  },

  mobileStyle: {
    width: "100%",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 25,
    gap: 25,
  },

  input: {
    backgroundColor: "#ffffff",
    paddingLeft: 15,
    paddingRight: 15,
    borderColor: "grey",
    borderWidth: 1,
    flex: 1,
    width: "100%",
    paddingVertical: 12,
  },
  btn: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 25,
    paddingVertical: 15,
    textAlign: "center",
    alignItems: "center",
    color: theme.colors.text,
    width: "50%",
  },
});
