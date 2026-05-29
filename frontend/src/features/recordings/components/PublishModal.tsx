import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import client from "../../../lib/api/client";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";
import Button from "../../../components/ui/Button";

interface User {
  id: number;
  username: string;
  full_name: string;
}

interface PublishModalProps {
  open: boolean;
  initialSelected?: User[];
  onClose: () => void;
  onPublish: (userIds: number[]) => Promise<void> | void;
}

export default function PublishModal({
  open,
  initialSelected = [],
  onClose,
  onPublish,
}: PublishModalProps) {
  const { t } = useTranslation(["recordings", "common"]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>(initialSelected);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(initialSelected);
    setSearch("");
    setResults([]);
  }, [open, initialSelected]);

  useEffect(() => {
    if (!open) return;
    const term = search.trim();
    if (!term) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    const id = window.setTimeout(async () => {
      try {
        const res = await client.get(`/auth/search/`, { params: { q: term } });
        setResults(res.data);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(id);
  }, [search, open]);

  if (!open) return null;

  const toggle = (u: User) => {
    setSelected((prev) =>
      prev.some((x) => x.id === u.id)
        ? prev.filter((x) => x.id !== u.id)
        : [...prev, u],
    );
  };

  const handlePublish = async () => {
    setIsSubmitting(true);
    try {
      await onPublish(selected.map((u) => u.id));
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--s2)] rounded-2xl border border-[var(--b)] shadow-2xl fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--b)]">
          <div>
            <div className="text-sm font-semibold text-[var(--t1)]">
              {t("publishModal.title")}
            </div>
            <div className="text-[11px] text-[var(--t3)]">
              {t("publishModal.subtitle")}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-transparent border-none cursor-pointer text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--s3)] flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3">
          <div className="relative">
            <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--t3)]">
              {Icons.search}
            </span>
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("publishModal.searchPlaceholder")}
              className="w-full bg-[var(--s3)] border border-[var(--b)] rounded-lg ps-8 pe-3 py-2 text-xs text-[var(--t1)] placeholder-[var(--t3)] outline-none focus:border-[var(--brand)] transition-colors"
            />
            {isSearching && (
              <div className="absolute end-3 top-1/2 -translate-y-1/2">
                <div className="w-3 h-3 border-2 border-[var(--brand)]/30 border-t-[var(--brand)] rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((u) => (
                <button
                  key={u.id}
                  onClick={() => toggle(u)}
                  className="flex items-center gap-1.5 px-2 h-6 rounded-full border-none cursor-pointer bg-[var(--brand-soft)] text-[var(--brand-text)] text-[11px] hover:brightness-110"
                >
                  {u.full_name || u.username}
                  <span className="opacity-60">✕</span>
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
            {search.trim() && !isSearching && results.length === 0 && (
              <p className="text-xs text-[var(--t3)] text-center py-3">
                {t("publishModal.noResults")}
              </p>
            )}
            {results.map((u) => {
              const checked = selected.some((x) => x.id === u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggle(u)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-lg border-none cursor-pointer text-start transition-colors",
                    checked
                      ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                      : "bg-transparent text-[var(--t1)] hover:bg-[var(--s3)]",
                  )}
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center text-[10px]",
                      checked
                        ? "bg-[var(--brand)] border-[var(--brand)] text-white"
                        : "border-[var(--b)]",
                    )}
                  >
                    {checked && "✓"}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium truncate">
                      {u.full_name || u.username}
                    </span>
                    <span className="block text-[10px] text-[var(--t3)] truncate">
                      @{u.username}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {selected.length > 0 && (
            <div className="text-[11px] text-[var(--t3)]">
              {t("publishModal.selectedCount", { count: selected.length })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--b)] flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("publishModal.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            loading={isSubmitting}
          >
            {t("publishModal.publish")}
          </Button>
        </div>
      </div>
    </div>
  );
}
