import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

/**
 * Reusable hook to synchronize a query parameter state with the React Router URL search params.
 * Allows quick actions across pages to carry over filtering state seamlessly.
 */
export function useQueryParamState(
  key: string,
  defaultValue: string = ""
): [string, (newValue: string | null | undefined) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = searchParams.get(key) ?? defaultValue;

  const setValue = useCallback(
    (newValue: string | null | undefined) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (newValue === null || newValue === undefined || newValue === "") {
            next.delete(key);
          } else {
            next.set(key, newValue);
          }
          return next;
        },
        { replace: true }
      );
    },
    [key, setSearchParams]
  );

  return [value, setValue];
}
