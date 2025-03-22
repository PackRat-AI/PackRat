import React from 'react';
import { AddItem } from './AddItem';
import useTheme from 'app/hooks/useTheme';
import { BaseModal } from '@packrat/ui';
import RPrimaryButton from 'app/components/RPrimaryButton';

interface AddItemModalProps {
  currentPackId: string;
  currentPack: any;
  isAddItemModalOpen: boolean;
  setIsAddItemModalOpen: any;
  setRefetch?: () => void;
  showTrigger?: boolean;
  initialData?: any;
}

export const AddItemModal = ({
  currentPackId,
  currentPack,
  isAddItemModalOpen,
  setIsAddItemModalOpen,
  showTrigger = true,
  setRefetch = () => {},
  initialData,
}: AddItemModalProps) => {
  const { currentTheme } = useTheme();

  return (
    <BaseModal
      title="Add Item"
      triggerComponent={
        <RPrimaryButton
          label="+ Add Item"
          onPress={() => setIsAddItemModalOpen(true)}
        />
      }
      showTrigger={showTrigger}
      footerComponent={undefined}
      isOpen={isAddItemModalOpen}
      onOpen={() => setIsAddItemModalOpen(true)}
      onClose={() => setIsAddItemModalOpen(false)}
    >
      <AddItem
        initialData={initialData}
        packId={currentPackId}
        currentPack={currentPack}
        setRefetch={setRefetch}
        closeModalHandler={() => setIsAddItemModalOpen(false)}
      />
    </BaseModal>
  );
};
