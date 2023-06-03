import { StyleSheet } from "react-native";
import { Box, Text } from "native-base";
import { useEffect, useState } from "react";

import DropdownComponent from "../Dropdown";
import useGetPacks from "../../hooks/useGetPacks";
import { AddItem } from "../AddItem";
import { TableContainer } from "../pack_table/Table";
// import { useAuth } from "../../auth/provider";
import { useSelector } from "react-redux";
import { fetchUserPacks, selectPackById } from "../../store/packsStore";
import { updateNewTripPack } from "../../store/tripsStore";
import { useDispatch } from "react-redux";

import { CustomModal } from "../modal";

export default function PackContainer({ isCreatingTrip = false }) {
  const dispatch = useDispatch();
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);

  const user = useSelector((state) => state.auth.user);
  const packs = useSelector((state) => state.packs.packs);

  const newTrip = useSelector((state) => state.trips.newTrip);

  const [currentPackId, setCurrentPackId] = useState(null);

  useEffect(() => {
    if (user && user._id) {
      dispatch(fetchUserPacks(user?._id));
    }
  }, [dispatch, user?._id]);

  const handlePack = (val) => {
    const selectedPack = packs.find((pack) => pack._id === val);
    setCurrentPackId(selectedPack?._id);

    if (isCreatingTrip && selectedPack?._id) {
      dispatch(updateNewTripPack(selectedPack?._id));
    }
  };

  const currentPack = useSelector((state) =>
    selectPackById(state, currentPackId)
  );

  const dataValues = packs ?? [];

  return dataValues?.length > 0 ? (
    <Box style={styles.mainContainer}>
      <DropdownComponent
        data={dataValues}
        value={currentPackId}
        setUnit={handlePack}
        width="300"
      />
      {currentPackId && (
        <>
          <CustomModal
            title="Add Item"
            trigger="Add Item"
            isActive={isAddItemModalOpen}
            onTrigger={setIsAddItemModalOpen}
            footerButtons={[
              {
                label: "Save",
                color: "primary",
                onClick: () => setIsAddItemModalOpen(false),
              },
              {
                label: "Cancel",
                color: "danger",
                onClick: () => setIsAddItemModalOpen(false),
              },
            ]}
          >
            <AddItem packId={currentPackId} />
          </CustomModal>
          <TableContainer
            key={`table - ${currentPackId}`}
            currentPack={currentPack}
          />
        </>
      )}
    </Box>
  ) : null;
}


const styles = StyleSheet.create({
  mainContainer: {
    flexDirection: "column",
    alignItems: "center",
    gap: 35,
    width: "100%",
    padding: 20,
  },
});
