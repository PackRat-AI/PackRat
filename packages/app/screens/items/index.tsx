import { View, Platform } from 'react-native';
import React, { useEffect, useState } from 'react';
import { Box, Button, ScrollView, Tooltip } from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../../theme';
import useTheme from '../../hooks/useTheme';
import { AddItemGlobal } from '../../components/item/AddItemGlobal';
import { ItemsTable } from '../../components/itemtable/itemTable';
import { useDispatch, useSelector } from 'react-redux';
import { getItemsGlobal } from '../../store/globalItemsStore';
import { Stack } from 'expo-router';
import { executeOfflineRequests } from '../../store/offlineQueue';
import useCustomStyles from 'app/hooks/useCustomStyles';
import { BaseModal } from '@packrat/ui';
// import { checkNetworkConnected } from 'app/utils/netInfo';

export default function Items() {
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [limit, setLimit] = useState(5);
  const [page, setPage] = useState(1);
  const [refetch, setRefetch] = useState(false);
  const styles = useCustomStyles(loadStyles);
  const data = useSelector((state) => state.globalItems);
  const isLoading = useSelector((state) => state.globalItems.isLoading);
  const isError = useSelector((state) => state.globalItems.isError);
  const { isConnected, requests } = useSelector((state) => state.offlineQueue);

  const dispatch = useDispatch();

  useEffect(() => {
    if (isConnected) {
      dispatch(executeOfflineRequests(requests));
    }
  }, []);

  useEffect(() => {
    if (isConnected && requests.length == 0)
      dispatch(getItemsGlobal({ limit, page }));
  }, [limit, page, refetch, isConnected]);

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          title: 'Items',
        }}
      />
      <Box style={styles.container}>
        <BaseModal
          title="Add a global Item"
          trigger="Add Item"
          triggerComponent={<ModalTriggerButton />}
        >
          <AddItemGlobal setRefetch={setRefetch} refetch={refetch} />
        </BaseModal>
        {!isError &&
          data.globalItems &&
          Array.isArray(data.globalItems.items) && (
            <ItemsTable
              limit={limit}
              setLimit={setLimit}
              page={page}
              setPage={setPage}
              data={data}
              isLoading={isLoading}
              totalPages={data?.globalItems?.totalPages}
              refetch={refetch}
              setRefetch={setRefetch}
            />
          )}
      </Box>
    </ScrollView>
  );
}

const ModalTriggerButton = ({ setIsModalOpen }) => {
  const { currentTheme } = useTheme();
  const styles = useCustomStyles(loadStyles);

  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'row',
        marginTop: '2rem',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Button
        style={styles.button}
        onPress={() => {
          setIsModalOpen(true);
        }}
      >
        Add Item
      </Button>
      {Platform.OS === 'web' && (
        <Tooltip label="Add a global item" placement="top left" openDelay={500}>
          <Button width={8} height={8} style={{ backgroundColor: 'none' }}>
            <MaterialIcons
              name="info-outline"
              size={20}
              color={currentTheme.colors.background}
            />
          </Button>
        </Tooltip>
      )}
    </View>
  );
};

const loadStyles = (theme) => {
  const { currentTheme } = theme;

  return {
    container: {
      backgroundColor: currentTheme.colors.background,
      flexDirection: 'column',
      flex: 1,
    },
    button: {
      color: currentTheme.colors.white,
      width: Platform.OS === 'web' ? '20rem' : '20%',
      display: 'flex',
      alignItems: 'center',
      textAlign: 'center',
    },
  };
};
