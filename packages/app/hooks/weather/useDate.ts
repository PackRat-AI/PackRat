import { format } from 'date-fns';
import { getCurrentUTCDate } from 'app/utils/dates';

export const useDate = () => {
  const date = getCurrentUTCDate();
  const dateFormatted = format(date, 'MMMM d, yyyy');
  const day = date.getDay();

  return { dateFormatted, day };
};
