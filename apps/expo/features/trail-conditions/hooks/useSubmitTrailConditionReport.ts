import { nanoid } from 'nanoid/non-secure';
import { useCallback } from 'react';
import { trailConditionReportsStore } from '../store/trailConditionReports';
import type { TrailConditionReportInput, TrailConditionReportInStore } from '../types';

export function useSubmitTrailConditionReport() {
  const submitReport = useCallback((reportData: TrailConditionReportInput) => {
    const id = `tcr_${nanoid()}`;
    const timestamp = new Date().toISOString();

    const newReport: TrailConditionReportInStore = {
      id,
      ...reportData,
      deleted: false,
      localCreatedAt: timestamp,
      localUpdatedAt: timestamp,
    };

    // @ts-expect-error: Safe because Legend-State uses Proxy
    trailConditionReportsStore[id].set(newReport);

    return id;
  }, []);

  return submitReport;
}
