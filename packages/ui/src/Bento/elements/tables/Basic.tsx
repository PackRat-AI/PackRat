import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMedia } from 'tamagui';
import * as React from 'react';
import { Separator, Text, View, YStack, getTokenValue } from 'tamagui';
import { Table } from './common/tableParts';
import { DeletePackItemModal } from 'app/components/pack_table/DeletePackItemModal';
import { EditPackItemModal } from 'app/components/pack_table/EditPackItemModal';
import { AddItem } from 'app/components/item/AddItem';
import { ZDropdown, ThreeDotsMenu, YStack, RButton } from '@packrat/ui';
import { Platform } from 'react-native';

type Person = {
  firstName: string;
  lastName: string;
  age: number;
  visits: number;
  status: string;
  progress: number;
};

const defaultData: Person[] = [
  {
    firstName: 'hary',
    lastName: 'potter',
    age: 24,
    visits: 100,
    status: 'In Relationship',
    progress: 50,
  },
  {
    firstName: 'andy',
    lastName: 'loren',
    age: 40,
    visits: 40,
    status: 'Single',
    progress: 80,
  },
  {
    firstName: 'masoud',
    lastName: 'epsum',
    age: 45,
    visits: 20,
    status: 'Complicated',
    progress: 10,
  },
];

const columnHelper = createColumnHelper<Person>();

const columns = [
  columnHelper.accessor('firstName', {
    cell: (info) => info.getValue(),
    footer: (info) => info.column.id,
  }),
  columnHelper.accessor((row) => row.lastName, {
    id: 'lastName',
    cell: (info) => info.getValue(),
    header: () => 'Last Name',
    footer: (info) => info.column.id,
  }),
  columnHelper.accessor('age', {
    header: () => 'Age',
    cell: (info) => info.renderValue(),
    footer: (info) => info.column.id,
  }),
  columnHelper.accessor('visits', {
    header: () => 'Vists',
    footer: (info) => info.column.id,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    footer: (info) => info.column.id,
  }),
  columnHelper.accessor('progress', {
    header: 'Progress',
    footer: (info) => info.column.id,
  }),
];

const CELL_WIDTH = '$15';

/** ------ EXAMPLE ------ */
export function BasicTable({
  groupedData,
  onDelete,
  hasPermissions,
  currentPack,
  refetch,
  setRefetch,
}: BasicTableProps) {
  console.log('Grouped Data', groupedData);

  const columnHelper = createColumnHelper<Item>();
  const columns = [
    columnHelper.accessor('name', {
      cell: (info) => info.getValue(),
      header: () => 'Name',
      footer: (info) => info.column.id,
    }),
    columnHelper.accessor('weight', {
      cell: (info) => `${info.getValue()} ${info.row.original.unit}`,
      header: () => 'Weight',
      footer: (info) => info.column.id,
    }),
    columnHelper.accessor('quantity', {
      header: () => 'Quantity',
      cell: (info) => info.renderValue(),
      footer: (info) => info.column.id,
    }),
    columnHelper.accessor(`category.name`, {
      header: () => 'Category',
      cell: (info) => info.getValue(),
      footer: (info) => 'category',
    }),
    columnHelper.display({
      id: 'actions',
      cell: (props) => <ActionButtons item={props.row.original} />,
      header: () => 'Actions',
      footer: (info) => info.column.id,
    }),
  ];

  React.useEffect(() => {
    setActiveModal(null);
  }, [groupedData]);

  const CELL_WIDTH = '$18';

  const [activeModal, setActiveModal] = React.useState<string | null>(null);

  const openModal = (modalName: string) => {
    setActiveModal(modalName);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  const dropdownItems = [
    { label: 'Edit', onSelect: () => openModal('edit') },
    { label: 'Delete', onSelect: () => openModal('delete') },
  ];

  const ActionButtons = ({ item }) => {
    return (
      <>
        <EditPackItemModal
          isOpen={activeModal === 'edit'}
          onClose={closeModal}
          triggerComponent={undefined}
          showTrigger={false}
        >
          <AddItem
            id={item.id}
            packId={item.id}
            isEdit={true}
            initialData={item}
          />
        </EditPackItemModal>
        <DeletePackItemModal
          isOpen={activeModal === 'delete'}
          onClose={closeModal}
          onConfirm={() =>
            onDelete({ itemId: item.id, packId: currentPack.id })
          }
        />
        {hasPermissions ? (
          Platform.OS === 'android' ||
          Platform.OS === 'ios' ||
          window.innerWidth < 900 ? (
            <View>
              <ZDropdown.Native dropdownItems={dropdownItems} />
            </View>
          ) : (
            <View>
              <ThreeDotsMenu >
                <YStack space="$1">
                  {
                    dropdownItems.map((item) => {
                      return(
                        <RButton onPress={item.onSelect}>{item.label}</RButton>
                      )
                    })
                  }
                </YStack>
              </ThreeDotsMenu>
            </View>
          )
        ) : null}
      </>
    );
  };

  // Flatten the grouped data into a single array of items
  const data = Object.values(groupedData).flat();

  const [tableData, setTableData] = React.useState<Item[]>(data);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { sm } = useMedia();

  const headerGroups = table.getHeaderGroups();
  const tableRows = table.getRowModel().rows;
  const footerGroups = table.getFooterGroups();

  const allRowsLenght =
    tableRows.length + headerGroups.length + footerGroups.length;
  const rowCounter = React.useRef(-1);
  rowCounter.current = -1;

  if (sm) {
    return (
      <YStack gap="$4" width="100%">
        {defaultData.map((row, i) => {
          return (
            <View
              key={i}
              borderRadius="$4"
              borderWidth="$1"
              borderColor="$borderColor"
              flex={1}
              alignSelf="stretch"
              gap="$3"
            >
              <View gap="$3" mx="$3" my="$3">
                {Object.entries(row).map(([name, value], i) => {
                  return (
                    <View key={i}>
                      <View fd="row" justifyContent="space-between">
                        <Text>
                          {name.charAt(0).toUpperCase() + name.slice(1)}
                        </Text>
                        <Text color="$gray10">{value}</Text>
                      </View>
                      {i !== Object.entries(row).length - 1 && (
                        <Separator mt="$3" />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </YStack>
    );
  }

  return (
    <Table
      alignCells={{ x: 'center', y: 'center' }}
      alignHeaderCells={{ y: 'center', x: 'center' }}
      cellWidth={CELL_WIDTH}
      cellHeight="$5"
      borderWidth={0.5}
      maxWidth={getTokenValue(CELL_WIDTH) * columns.length}
    >
      <Table.Head>
        {headerGroups.map((headerGroup) => {
          rowCounter.current++;
          return (
            <Table.Row
              backgrounded
              backgroundColor="$color2"
              rowLocation={
                rowCounter.current === 0
                  ? 'first'
                  : rowCounter.current === allRowsLenght - 1
                    ? 'last'
                    : 'middle'
              }
              key={headerGroup.id}
            >
              {headerGroup.headers.map((header) => (
                <Table.HeaderCell
                  cellLocation={
                    header.id === 'firstName'
                      ? 'first'
                      : header.id === 'progress'
                        ? 'last'
                        : 'middle'
                  }
                  key={header.id}
                >
                  <Text>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </Text>
                </Table.HeaderCell>
              ))}
            </Table.Row>
          );
        })}
      </Table.Head>
      <Table.Body>
        {tableRows.map((row) => {
          rowCounter.current++;
          return (
            <Table.Row
              rowLocation={
                rowCounter.current === 0
                  ? 'first'
                  : rowCounter.current === allRowsLenght - 1
                    ? 'last'
                    : 'middle'
              }
              key={row.id}
            >
              {row.getVisibleCells().map((cell) => (
                <Table.Cell
                  cellLocation={
                    cell.column.id === 'firstName'
                      ? 'first'
                      : cell.column.id === 'progress'
                        ? 'last'
                        : 'middle'
                  }
                  key={cell.id}
                >
                  <Text color="$gray11">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Text>
                </Table.Cell>
              ))}
            </Table.Row>
          );
        })}
      </Table.Body>
      <Table.Foot>
        {footerGroups.map((footerGroup) => {
          rowCounter.current++;
          return (
            <Table.Row
              rowLocation={
                rowCounter.current === 0
                  ? 'first'
                  : rowCounter.current === allRowsLenght - 1
                    ? 'last'
                    : 'middle'
              }
              key={footerGroup.id}
            >
              {footerGroup.headers.map((header, index) => (
                <Table.HeaderCell
                  cellLocation={
                    index === 0
                      ? 'first'
                      : index === footerGroup.headers.length - 1
                        ? 'last'
                        : 'middle'
                  }
                  key={header.id}
                >
                  <Text>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.footer,
                          header.getContext(),
                        )}
                  </Text>
                </Table.HeaderCell>
              ))}
            </Table.Row>
          );
        })}
      </Table.Foot>
    </Table>
  );
}

BasicTable.fileName = 'Basic';
