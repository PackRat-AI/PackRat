import { Link } from "expo-router";
import { Stack, VStack, Text, Button } from "native-base";
import { Platform } from "react-native";
import UserDataCard from "./UserDataCard";
import { useEffect, useState } from "react";

export default function UserDataContainer({ data, type }) {
  const [dataState, setDataState] = useState(
    data.length > 0 ? Array(data.length).fill(false) : []
  );
  useEffect(() => {
    setDataState(Array(data.length).fill(false));
  }, [data]);
  const typeUppercase = type.charAt(0).toUpperCase() + type.slice(1);

  const typeUppercaseSingular = typeUppercase.slice(0, -1);

  const cardType = type === "packs" ? "pack" : "trip";

  return (
    <VStack space={2} alignItems="center" flex={1} width="100%">
      <Text fontSize="2xl" fontWeight="bold" color="white" uppercase={true}>
        Your {typeUppercase}
      </Text>
      <Stack
        direction={["column", "column", "column", "row"]}
        space={[5, 5, 5, 1.5]}
        flexWrap="wrap"
      >
        {data && data.length > 0 ? (
          data?.map((dataItem, index) => (
            <UserDataCard
              key={dataItem._id}
              {...{ ...dataItem }}
              type={cardType}
              state={dataState}
              setState={setDataState}
              index={index}
            />
          ))
        ) : (
          <Link href="/">
            <Button
              _text={{
                color: "white",
              }}
              w={["100%", "100%", "100%", "auto"]}
            >
              {`Create your first ${typeUppercaseSingular}`}
            </Button>
          </Link>
        )}
      </Stack>
    </VStack>
  );
}
