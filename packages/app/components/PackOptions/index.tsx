import { View } from 'react-native';
import { RStack, RIconButton, BaseModal } from '@packrat/ui';
import { Entypo } from '@expo/vector-icons';
import { useModalState } from './useModalState';
export const PackOptions = ({ Edit, Delete, Ignore }) => {
  const { isModalOpen, openModal, closeModal } = useModalState();

  return (
    <View>
      <BaseModal
        isOpen={isModalOpen}
        onClose={closeModal}
        triggerComponent={<MenuTriggerComponent openModal={openModal} />}
      >
        <RStack style={{ flexDirection: 'row', alignItems: 'center' }}>
          {Edit} Edit{' '}
        </RStack>
        <RStack style={{ flexDirection: 'row', alignItems: 'center' }}>
          {Delete} Delete{' '}
        </RStack>
        <RStack
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          {Ignore}{' '}
        </RStack>
      </BaseModal>
    </View>
  );
};

const MenuTriggerComponent = ({ openModal }) => {
  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <RIconButton
        backgroundColor="transparent"
        icon={<Entypo name="dots-three-horizontal" size={24} color="black" />}
        onPress={openModal}
      />
    </View>
  );
};
