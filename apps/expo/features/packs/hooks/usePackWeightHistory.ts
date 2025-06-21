import { use$ } from '@legendapp/state/react';
import { useQuery } from '@tanstack/react-query';

import axiosInstance, { handleApiError } from '~/lib/api/client';
import { packsStore } from '../store';
import { packWeigthHistoryStore } from '../store/packWeightHistory';

export type PackMonthlyAverage = {
  month: string;
  average_weight: number;
};

// Helper: Compute monthly average weights from history
const getMonthlyWeightAverages = (data: any[]) => {
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const monthData: Record<string, { totalWeight: number; count: number }> = {};

  data.forEach((entry) => {
    const date = new Date(entry.createdAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`; // "YYYY-M"
    if (!monthData[key]) {
      monthData[key] = { totalWeight: 0, count: 0 };
    }
    monthData[key].totalWeight += entry.weight;

    monthData[key].count += 1;
  });

  const monthlyAverages = Object.entries(monthData).map(([key, { totalWeight, count }]) => {
    const [year, monthIndex] = key.split('-').map(Number);
    return {
      year,
      month: monthNames[monthIndex],
      average_weight: parseFloat((totalWeight / count).toFixed(2)),
    };
  });

  // Sort chronologically by year + month
  return monthlyAverages.sort((a, b) => {
    const aKey = `${a.year}-${monthNames.indexOf(a.month)}`;
    const bKey = `${b.year}-${monthNames.indexOf(b.month)}`;
    return aKey.localeCompare(bKey);
  });
};

// Helper: Filter entries within the last 6 months
const filterLast6Months = (data: any[]) => {
  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(today.getMonth() - 6);
  return data.filter((entry) => new Date(entry.localCreatedAt) >= sixMonthsAgo);
};

export function usePackWeightHistory(packId: string) {
  const weightHistory = use$(() => {
    const history = Object.values(packWeigthHistoryStore.get())
      .filter((item) => item.packId === packId)
      .sort((a, b) => {
        // Convert dates to timestamps for comparison
        const dateA = new Date(a.localCreatedAt).getTime();
        const dateB = new Date(b.localCreatedAt).getTime();

        // Sort descending (latest first)
        return dateB - dateA;
      });

    const filtered = filterLast6Months(history);
    const monthlyAverages = getMonthlyWeightAverages(filtered);

    return monthlyAverages;
  });

  return weightHistory;
}
