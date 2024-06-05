import { View, Platform } from 'react-native';
import React, { useEffect, useState } from 'react';
import {
  RButton,
  RScrollView,
  RTooltip,
  RStack,
  BaseModal,
  RText,
} from '@packrat/ui';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from 'app/theme';
import useTheme from 'app/hooks/useTheme';
import { AddItemGlobal } from 'app/components/item/AddItemGlobal';
import { ItemsTable } from 'app/components/itemtable/itemTable';
// import { Stack } from 'expo-router';
import useCustomStyles from 'app/hooks/useCustomStyles';
import { useItems } from 'app/hooks/items/useItems';
import { usePagination } from 'app/hooks/common';
import DropdownComponent from 'app/components/Dropdown';
// import { checkNetworkConnected } from 'app/utils/netInfo';

export default function Items() {
  const { enableDarkMode, enableLightMode, isDark, isLight, currentTheme } =
    useTheme();

  const { limit, handleLimitChange, page, handlePageChange } = usePagination();
  const { data, isFetching, isError } = useItems({ limit, page });
  const styles = useCustomStyles(loadStyles);
  const [value, setValue] = useState('Food');
  const [sortedItems, setSortedItems] = useState([]);
  const optionValues = ['Food', 'Water', 'Essentials'];

  const sortItemsByCategory = (items, selectedCategory) => {
    const selectedCategoryItems = items.filter(
      (item) => item.category.name === selectedCategory,
    );
    const otherItems = items.filter(
      (item) => item.category.name !== selectedCategory,
    );

    selectedCategoryItems.sort((a, b) => a.name.localeCompare(b.name));
    otherItems.sort((a, b) => a.name.localeCompare(b.name));

    return [...selectedCategoryItems, ...otherItems];
  };

  const handleSort = (category) => {
    setValue(category);
    const sorted = sortItemsByCategory(data.items, category);
    setSortedItems(sorted);
  };

  useEffect(() => {
    const sorted = sortItemsByCategory(data.items, value);
    setSortedItems(sorted);
  }, [data.items, value]);

  return (
    <RScrollView>
      {/* <Stack.Screen
        options={{
          title: 'Items',
        }}
      /> */}
      <RStack style={styles.mainContainer}>
        <RStack style={styles.container}>
          <RStack style={styles.sortContainer}>
            <RText style={{ fontWeight: 'bold' }}>Sort By:</RText>
            <DropdownComponent
              value={value}
              data={optionValues}
              onValueChange={handleSort}
              placeholder="Sort By"
              width={Platform.OS === 'web' ? 150 : 120}
            />
          </RStack>
          <BaseModal
            title="Add a global Item"
            trigger="Add Item"
            // triggerComponent={<ModalTriggerButton />}
          >
            <AddItemGlobal />
          </BaseModal>
        </RStack>
        {!isError && data?.items && Array.isArray(data.items) && (
          <ItemsTable
            limit={limit}
            setLimit={handleLimitChange}
            page={page}
            setPage={handlePageChange}
            data={sortedItems}
            isLoading={isFetching}
            totalPages={data?.totalPages}
          />
        )}
      </RStack>
    </RScrollView>
  );
}

// const ModalTriggerButton = ({ setIsModalOpen }) => {
//   const { currentTheme } = useTheme();
//   const styles = useCustomStyles(loadStyles);

//   return (
//     <View
//       style={{
//         display: 'flex',
//         flexDirection: 'row',
//         marginTop: '2rem',
//         justifyContent: 'center',
//         alignItems: 'center',
//       }}
//     >
//       <RButton
//         style={styles.button}
//         onPress={() => {
//           setIsModalOpen(true);
//         }}
//       >
//         Add Item
//       </RButton>
//       {Platform.OS === 'web' && (
//         <RTooltip
//           label="Add a global item"
//           placement="top left"
//           openDelay={500}
//         >
//           <RButton width={8} height={8} style={{ backgroundColor: 'none' }}>
//             <MaterialIcons
//               name="info-outline"
//               size={20}
//               color={currentTheme.colors.background}
//             />
//           </RButton>
//         </RTooltip>
//       )}
//     </View>
//   );
// };

const loadStyles = (theme) => {
  const { currentTheme } = theme;

  return {
    mainContainer: {
      backgroundColor: currentTheme.colors.background,
      flexDirection: 'column',
      flex: 1,
      paddingTop: 10,
      alignItems: 'center',
    },
    button: {
      color: currentTheme.colors.white,
      width: Platform.OS === 'web' ? '20rem' : '20%',
      display: 'flex',
      alignItems: 'center',
      textAlign: 'center',
    },
    container: {
      backgroundColor: currentTheme.colors.card,
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '60%',
      padding: 30,
      borderRadius: 10,
    },
    sortContainer: {
      flexDirection: 'row',
      gap: Platform.OS === 'web' ? 10 : 60,
      alignItems: 'center',
    },
  };
};
