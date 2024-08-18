import { View } from 'react-native';
import { ItemForm } from './ItemForm'; // assuming you moved the form related code to a separate component
import { useAddPackItem, useEditPackItem } from 'app/modules/pack';
import {
  addItem as addItemSchema,
  editItem as editItemSchema,
  type Item,
} from '@packrat/validations';
import { useMemo } from 'react';
import { useAuthUser } from 'app/modules/auth';

interface AddItemProps {
  id?: string;
  isEdit?: boolean;
  initialData?: {
    global: string;
    id: string;
    name?: string;
    weight?: number;
    quantity?: number;
    category?: {
      name: string;
    };
    unit?: string;
  };
  packId: string;
  currentPack?: any;
  editAsDuplicate?: any;
  setPage?: (page: number) => void;
  page?: number;
  isItemPage?: boolean;
  closeModalHandler?: () => void;
  setIsAddItemModalOpen?: (isOpen: boolean) => void;
  setRefetch?: () => void;
}

type AddItem = Omit<Item, 'id'> & { id: string };

export const AddItem = ({
  isEdit,
  initialData,
  packId,
  currentPack,
  editAsDuplicate,
  setPage = (page: number) => {}, // temp fix, need props type
  page,
  closeModalHandler,
  isItemPage,
  setIsAddItemModalOpen = () => {},
}: AddItemProps) => {
  // const [currPackId] = usePackId();

  const user = useAuthUser();

  const ownerId = user?.id;

  const {
    // mutation: addPackItemMutation
    isLoading,
    isError,
    addPackItem,
  } = useAddPackItem();
  const {
    // mutation: addPackItemMutation

    editPackItem,
  } = useEditPackItem(isItemPage);

  const handleSubmit = (data: Item) => {
    if (isEdit) {
      // editPackItem(data as AddItem);
      editPackItem(data as any);
    } else {
      addPackItem(data);
    }
    if (closeModalHandler) closeModalHandler();
  };

  const defaultValues = useMemo(() => {
    if (!initialData) {
      return { unit: 'lb', ownerId, packId };
    }
    const result = {
      id: '',
      ownerId,
      name: initialData.name || '',
      weight: initialData.weight,
      quantity: initialData.quantity,
      type: initialData.category?.name,
      unit: initialData.unit,
      packId,
    };

    if (isEdit) {
      result.id = initialData.id;

      return result;
    }

    return result;
  }, [initialData, isEdit, packId, ownerId]);

  return (
    <View>
      <ItemForm
        validationSchema={isEdit ? editItemSchema : addItemSchema}
        handleSubmit={handleSubmit}
        defaultValues={defaultValues}
        isLoading={isLoading}
        isEdit={isEdit}
        currentPack={currentPack}
      />
    </View>
  );
};
