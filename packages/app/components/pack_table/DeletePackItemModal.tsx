import React from 'react';
import { useDeletePackItem } from 'app/hooks/packs/useDeletePackItem';
import { BaseModal, CloseModalHandler } from '@packrat/ui';
import { useDeleteItem } from 'app/hooks/items';

interface DeletePackItemModalProps {
  onConfirm: (closeModal: CloseModalHandler) => void;
  isOpen?: boolean;
  onClose?: () => void;
  triggerComponent?: React.DetailedReactHTMLElement<any, HTMLElement>;
}

export const DeletePackItemModal = ({
  onConfirm,
  isOpen,
  onClose,
  triggerComponent,
}: DeletePackItemModalProps) => {
  const footerButtons = [
    {
      label: 'Cancel',
      onClick: (_, closeModal) => {
        closeModal();
        if (onClose) onClose();
      },
      color: 'gray',
      disabled: false,
    },
    {
      label: 'Delete',
      onClick: (_, closeModal) => onConfirm(closeModal),
      color: '#B22222',
      disabled: false,
    },
  ];

  return (
    <BaseModal
      title={'Delete Item'}
      triggerComponent={triggerComponent}
      isOpen={isOpen}
      onClose={onClose}
      showTrigger={!!triggerComponent}
      footerButtons={footerButtons}
    >
      Are you sure you want to delete this item?
    </BaseModal>
  );
};
