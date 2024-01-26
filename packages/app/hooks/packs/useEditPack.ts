import { useRouter } from 'app/hooks/router';
import { useDispatch } from 'react-redux';
import { updatePack } from 'app/store/packsStore';

export const useEditPack = () => {
  const dispatch = useDispatch();

  const handleEditPack = (packDetails) => {
    dispatch(updatePack(packDetails));
  };

  return handleEditPack;
};
