import { useQuery } from "@tanstack/react-query";
import axiosInstance from "expo-app/lib/api/client";
import type { Guide } from "../types";

export const useGuideDetails = (id: string) => {
  return useQuery({
    queryKey: ["guide", id],
    queryFn: async () => {
      const response = await axiosInstance.get<Guide>(`/api/guides/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};
