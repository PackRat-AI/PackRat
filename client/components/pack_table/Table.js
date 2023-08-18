import { FlatList, Platform, StyleSheet } from "react-native";
import { Table, Row, Cell, TableWrapper } from "react-native-table-component";
import { Feather } from "@expo/vector-icons";
import { Select, Checkbox, Box, Text, HStack, Button } from "native-base";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { convertWeight } from "../../utils/convertWeight";
import { EditPackItemModal } from "./EditPackItemModal";
import { ItemCategoryEnum } from "../../constants/itemCategory";
import { DeletePackItemModal } from "./DeletePackItemModal";
import { duplicatePackItem } from "../../store/packsStore";
import { formatNumber } from "../../utils/formatNumber";
import { theme } from "../../theme";
import { PackOptions } from "../PackOptions";
import CustomButton from "../custombutton";

const WeightUnitDropdown = ({ value, onChange }) => {
  return (
    <Select
      selectedValue={value}
      accessibilityLabel="Select weight unit"
      placeholder="Select weight unit"
      onValueChange={(itemValue) => onChange(itemValue)}
    >
      <Select.Item label="Kg Kilogram" value="kg" />
      <Select.Item label="G Gram" value="g" />
      <Select.Item label="Lb Pound" value="lb" />
      <Select.Item label="Oz Ounce" value="oz" />
    </Select>
  );
};

const TotalWeightBox = ({ label, weight, unit }) => {
  return (
    <Box style={styles.totalWeightBox}>
      <Text>{label}</Text>
      <Text>{`${formatNumber(weight)} (${unit})`}</Text>
    </Box>
  );
};

const IgnoreItemCheckbox = ({ itemId, isChecked, handleCheckboxChange }) => (
  <Box
    style={{
      justifyContent: "center",
      alignItems: "flex-start",
    }}
  >
    <Checkbox
      key={itemId}
      isChecked={isChecked}
      onChange={() => handleCheckboxChange(itemId)}
      aria-label="Ignore item"
    />
  </Box>
);

const Loading = () => <Text>Loading....</Text>;

const ErrorMessage = ({ message }) => <Text>{message}</Text>;

const TableItem = ({
  itemData,
  checkedItems,
  handleCheckboxChange,
  index,
  flexArr,
  currentPack,
  refetch,
  setRefetch = () => {},
}) => {
  const { name, weight, quantity, unit, _id } = itemData;

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const onTrigger = () => {
    console.log("called");
    setIsEditModalOpen(true);
  };
  const closeModalHandler = () => setIsEditModalOpen(false);

  let rowData = [];
  if (
    Platform.OS === "android" ||
    Platform.OS === "ios" ||
    window.innerWidth < 900
  ) {
    rowData = [
      name,
      `${formatNumber(weight)} ${unit}`,
      quantity,
      <PackOptions
        Edit={
          <EditPackItemModal
            packId={_id}
            initialData={itemData}
            currentPack={currentPack}
            refetch={refetch}
            setRefetch={setRefetch}
            onTrigger={onTrigger}
            isModalOpen={isEditModalOpen}
            closeModalHandler={closeModalHandler}
          />
        }
        Delete={
          <DeletePackItemModal
            itemId={_id}
            pack={currentPack}
            refetch={refetch}
            setRefetch={setRefetch}
          />
        }
        Ignore={
          <IgnoreItemCheckbox
            itemId={_id}
            isChecked={checkedItems.includes(_id)}
            handleCheckboxChange={handleCheckboxChange}
          />
        }
        editTrigger={onTrigger}
      />,
    ];
  } else {
    rowData = [
      name,
      `${formatNumber(weight)} ${unit}`,
      quantity,
      <EditPackItemModal
        packId={_id}
        initialData={itemData}
        currentPack={currentPack}
        refetch={refetch}
        setRefetch={setRefetch}
      />,
      <DeletePackItemModal
        itemId={_id}
        pack={currentPack}
        refetch={refetch}
        setRefetch={setRefetch}
      />,
      <IgnoreItemCheckbox
        itemId={_id}
        isChecked={checkedItems.includes(_id)}
        handleCheckboxChange={handleCheckboxChange}
      />,
    ];
  }

  /* 
  * this _id is passed as pack id but it is a item id which is confusing
  Todo need to change the name for this passing argument and remaining functions which are getting it
   */

  return <Row data={rowData} style={styles.row} flexArr={flexArr} />;
};

const CategoryRow = ({ category }) => {
  const categoryIcons = {
    [ItemCategoryEnum.ESSENTIALS]: "check-square",
    [ItemCategoryEnum.FOOD]: "coffee",
    [ItemCategoryEnum.WATER]: "droplet",
    [ItemCategoryEnum.CLOTHING]: "tshirt",
    [ItemCategoryEnum.SHELTER]: "home",
    [ItemCategoryEnum.SLEEPING]: "moon",
    [ItemCategoryEnum.HYGIENE]: "smile",
    [ItemCategoryEnum.TOOLS]: "tool",
    [ItemCategoryEnum.MEDICAL]: "heart",
    [ItemCategoryEnum.OTHER]: "more-horizontal",
    Undefined: "help-circle", // Choose an appropriate icon for "Undefined" category
  };

  const rowData = [
    <HStack style={styles.categoryRow}>
      <Feather name={categoryIcons[category]} size={16} color="white" />
      <Text style={styles.titleText}> {category}</Text>
    </HStack>,
  ];

  return (
    <Row data={rowData} style={[styles.title]} textStyle={styles.titleText} />
  );
};

const TitleRow = ({ title }) => {
  const rowData = [
    <HStack style={styles.mainTitle}>
      <Text style={styles.titleText}>{title}</Text>
    </HStack>,
  ];

  return (
    <Row data={rowData} style={[styles.title]} textStyle={styles.titleText} />
  );
};

export const TableContainer = ({
  currentPack,
  selectedPack,
  refetch,
  setRefetch = () => {},
  copy,
}) => {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  let ids = [];
  if (currentPack && currentPack.items) {
    ids = copy ? currentPack.items.map((item) => item._id) : [];
  }
  const [checkedItems, setCheckedItems] = useState([...ids]);

  const handleDuplicate = () => {
    const data = {
      packId: currentPack._id,
      ownerId: user._id,
      items: checkedItems,
    };
    dispatch(duplicatePackItem(data));
  };

  const [weightUnit, setWeightUnit] = useState("g");
  const isLoading = useSelector((state) => state.items.isLoading);
  const error = useSelector((state) => state.items.error);
  console.log("c", currentPack);
  const data = currentPack?.items;

  let totalFoodWeight = 0;
  let totalWaterWeight = 0;
  let totalBaseWeight = 0;

  let waterItem;
  let foodItems = [];
  // for calculating the total.
  /* 
  Todo better to move this all inside a utility function and pass them variables 
  */
  data &&
    data
      .filter((item) => !checkedItems.includes(item._id))
      .forEach((item) => {
        const categoryName = item.category ? item.category.name : "Undefined";
        if (!copy) {
          switch (categoryName) {
            case ItemCategoryEnum.ESSENTIALS: {
              totalBaseWeight += convertWeight(
                item.weight * item.quantity,
                item.unit,
                weightUnit
              );
              break;
            }
            case ItemCategoryEnum.FOOD: {
              totalFoodWeight += convertWeight(
                item.weight * item.quantity,
                item.unit,
                weightUnit
              );
              foodItems.push(item);
              break;
            }
            case ItemCategoryEnum.WATER: {
              totalWaterWeight += convertWeight(
                item.weight * item.quantity,
                item.unit,
                weightUnit
              );
              waterItem = item;
              break;
            }
          }
        }
      });

  let totalWeight = totalBaseWeight + totalWaterWeight + totalFoodWeight;

  const handleCheckboxChange = (itemId) => {
    setCheckedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  // In your groupedData definition, provide a default category for items without one
  const groupedData = data
    ?.filter((fItem) => !Array.isArray(fItem.category))
    ?.reduce((acc, item) => {
      const categoryName = item.category ? item.category.name : "Undefined";
      (acc[categoryName] = acc[categoryName] || []).push(item);
      return acc;
    }, {});

  let flexArr = [2, 1, 1, 1, 0.65, 0.65, 0.65];
  let heading = [
    "Item Name",
    `Weight`,
    "Quantity",
    "Edit",
    "Delete",
    `${copy ? "Copy" : "Ignore"}`,
  ];
  if (
    Platform.OS === "android" ||
    Platform.OS === "ios" ||
    window.innerWidth < 900
  ) {
    flexArr = [1, 1, 1, 1];
    heading = ["Item Name", `Weight`, "Quantity", "Options"];
  }
  console.log(heading);

  if (isLoading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  return (
    <Box style={styles.container}>
      {data?.length ? (
        <>
          <Table style={styles.tableStyle} flexArr={flexArr}>
            <TitleRow title="Pack List" />
            <Row
              flexArr={flexArr}
              data={heading.map((header, index) => (
                <Cell key={index} data={header} textStyle={styles.headerText} />
              ))}
              style={styles.head}
            />
            <FlatList
              data={Object.entries(groupedData)}
              keyExtractor={([category, items]) => category}
              renderItem={({ item: [category, items] }) => (
                <>
                  <CategoryRow category={category} />
                  <FlatList
                    data={items}
                    keyExtractor={(item, index) => item._id}
                    renderItem={({ item }) => (
                      <TableItem
                        itemData={item}
                        checkedItems={checkedItems}
                        handleCheckboxChange={handleCheckboxChange}
                        flexArr={flexArr}
                        currentPack={currentPack}
                        refetch={refetch}
                        setRefetch={setRefetch}
                      />
                    )}
                  />
                </>
              )}
            />
          </Table>
          <CustomButton text="Copy" handler={handleDuplicate} copy={copy} />
          <TotalWeightBox
            label="Base Weight"
            weight={totalBaseWeight}
            unit={weightUnit}
          />
          <TotalWeightBox
            label="Water + Food Weight"
            weight={totalWaterWeight + totalFoodWeight}
            unit={weightUnit}
          />
          <TotalWeightBox
            label="Total Weight"
            weight={totalWeight}
            unit={weightUnit}
          />
        </>
      ) : (
        <Text style={styles.noItemsText}>Add your First Item</Text>
      )}
      <WeightUnitDropdown value={weightUnit} onChange={setWeightUnit} />
    </Box>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    width: Platform.OS === "web" ? "100%" : 310,
  },
  tableStyle: {
    width: Platform.OS === "web" ? "100%" : 300,
    marginVertical: 20,
  },
  mainTitle: {
    marginTop: 10,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryRow: {
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  title: {
    height: 50,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    justifyContent: "center",
    paddingLeft: 15,
  },
  titleText: {
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  head: {
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#D1D5DB",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  headerText: {
    fontWeight: "bold",
    color: "#000000",
    fontSize: Platform.OS === "web" ? 12 : 8,
  },
  row: {
    flexDirection: "row",
    height: 60,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#D1D5DB",
  },
  infoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 25,
    backgroundColor: "#F8F8F8",
  },
  noItemsText: {
    fontWeight: "bold",
    fontSize: 16,
    marginTop: 20,
    textAlign: "center",
  },
  totalWeightBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: Platform.OS === "web" ? "100%" : 300,
    paddingHorizontal: 25,
    marginVertical: 30,
    flex: 1,
  },
});

export default TableContainer;
