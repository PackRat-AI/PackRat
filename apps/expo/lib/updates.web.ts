export const reloadAsync = async () => {
  window.location.reload();
};

export const checkForUpdateAsync = async () => ({ isAvailable: false });
export const fetchUpdateAsync = async () => ({ isNew: false });
export const useUpdates = () => ({ isUpdateAvailable: false, isUpdatePending: false });
export const isEnabled = false;
export const channel = 'web';
export const updateId = null;
export const runtimeVersion = '0.0.0';
