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
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Debounce search input to avoid spamming search requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

      if (debouncedSearchQuery.trim()) {
        params.q = debouncedSearchQuery.trim();
      }

      const data = await recordingsApi.list(params);
      setItems(data.results);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [filter, debouncedSearchQuery]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refresh]);

  return { items, isLoading, filter, setFilter, searchQuery, setSearchQuery, refresh };
}
