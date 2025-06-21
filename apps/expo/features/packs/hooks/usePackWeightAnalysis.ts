import { useQuery } from "@tanstack/react-query";
import axiosInstance, { handleApiError } from "~/lib/api/client";
import { usePackDetails } from "./usePackDetails";
import { computeCategorySummaries, convertFromGrams, convertToGrams } from "../utils";
import { userStore } from "~/features/auth/store";

export const getPackWeightAnalysis = async (packId: string): Promise<any> => {
  try {
    const response = await axiosInstance.get(`/api/weight-analysis/${packId}`);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to load weight analysis: ${message}`);
  }
};

export function usePackWeightAnalysis(packId: string) {
  const pack = usePackDetails(packId);

  const consumableWeightInGrams = pack.items
    .filter((item) => item.consumable)
    .reduce((sum, item) => {
      const unit = item.weightUnit || "g";
      const weight = item.weight || 0;
      return sum + convertToGrams(weight * item.quantity, unit);
    }, 0);

  const wornWeightInGrams = pack.items
    .filter((item) => item.worn)
    .reduce((sum, item) => {
      const unit = item.weightUnit || "g";
      const weight = item.weight || 0;
      return sum + convertToGrams(weight * item.quantity, unit);
    }, 0);

  const categorySummaries = computeCategorySummaries(pack);

  return {
    data: {
      baseWeight: pack.baseWeight,
      consumableWeight: convertFromGrams(
        consumableWeightInGrams,
        userStore.preferredWeightUnit.peek() ?? "g",
      ),
      wornWeight: convertFromGrams(wornWeightInGrams, userStore.preferredWeightUnit.peek() ?? "g"),
      totalWeight: pack.totalWeight,
      categories: categorySummaries,
    },
    items: pack.items,
  };
}
