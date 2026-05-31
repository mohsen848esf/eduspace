import { useCallback, useEffect, useState } from "react";
import recordingsApi, { type Recording } from "../api/recordings.api";

export type RecordingsFilter =
  | "all"
  | "published"
  | "drafts"
  | "processing"
  | "failed";

export function useRecordings(initialFilter: RecordingsFilter = "all") {
  const [items, setItems] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<RecordingsFilter>(initialFilter);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Parameters<typeof recordingsApi.list>[0] = {};
      if (filter === "published") params.published = true;
      else if (filter === "drafts") {
        params.published = false;
        params.status = "completed";
      } else if (filter === "processing") params.status = "processing";
      else if (filter === "failed") params.status = "failed";
      const data = await recordingsApi.list(params);
      setItems(data.results);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, isLoading, filter, setFilter, refresh };
}
