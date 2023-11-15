import React, { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { AddItem } from '../item/AddItem';
import { CustomModal } from '../modal';
import { Box } from 'native-base';

export const EditPackItemModal = ({
  initialData,
  packId,
  currentPack,
  editAsDuplicate,
  setPage,
  page,
  isModalOpen,
  onTrigger,
  closeModalHandler,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  let currentPackId;
  if (currentPack) {
    currentPackId = currentPack._id;
  }

  const onTriggerOpen = (newState) => {
    setModalOpen(newState);
  };
  const closeTriggerOpen = () => {
    onTriggerOpen(false);
  };
  const footerCloseHandler = closeModalHandler ?? closeTriggerOpen;

  const footerButtons = [
    {
      label: 'Cancel',
      onClick: footerCloseHandler,
      color: 'danger',
      disabled: false,
    },
    // add more footer buttons here if needed
  ];

  return (
    <Box>
      <CustomModal
        isActive={isModalOpen || modalOpen}
        title={'Edit Item'}
        triggerComponent={<MaterialIcons name="edit" size={20} color="black" />}
        onTrigger={onTrigger || onTriggerOpen}
        footerButtons={footerButtons}
        onCancel={closeModalHandler}
      >
        <AddItem
          _id={packId}
          packId={currentPackId}
          isEdit={true}
          initialData={initialData}
          editAsDuplicate={editAsDuplicate}
          setPage={setPage}
          page={page}
          closeModalHandler={closeModalHandler || closeTriggerOpen}
        />
      </CustomModal>
    </Box>
  );
};
