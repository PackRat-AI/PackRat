import { useRunQueryItem } from './useRunQueueItem';
import { useOfflineStore } from '../../atoms';

// Define the type for a request
type Request = {
  method: string;
  data: any;
};

export const useOfflineQueue = () => {
  const {
    isConnected,
    requests,
    setRequests,
  }: {
    isConnected: boolean;
    requests: Request[];
    setRequests: React.Dispatch<React.SetStateAction<Request[]>>;
  } = useOfflineStore();

  const runQueryItem = useRunQueryItem();
  const processQueue = () => {
    const queuePromises: (() => Promise<any>)[] = [];
    const requestsCopy = JSON.parse(JSON.stringify(requests));
    let runCount = 0;
    const onQueueEnd = () => {
      setRequests(requestsCopy.slice(runCount + 1));
    };

    requests.forEach((request) => {
      const { method, data } = request;
      queuePromises.push(runQueryItem.bind(null, method, data));
    });

    const runMutation = async (mutation) => {
      if (!mutation) {
        return onQueueEnd();
      }

      try {
        await mutation();
        runCount++;
        runMutation(requestsCopy[runCount]);
      } catch {
        onQueueEnd();
      }
    };

    runMutation(queuePromises[0]);
  };

  const handleAddOfflineRequest = (method, data) => {
    setRequests((prev) => [...prev, { method, data }]);
  };

  return {
    isConnected,
    addOfflineRequest: handleAddOfflineRequest,
    processQueue,
  };
};
