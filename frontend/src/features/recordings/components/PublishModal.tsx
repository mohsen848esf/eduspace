import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import client from "../../../lib/api/client";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";
import Button from "../../../components/ui/Button";
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../../components/ui/Modal";
import { roomApi } from "../../room/api/room.api";
import recordingsApi from "../api/recordings.api";

interface User {
  id: number;
  username: string;
  full_name: string;
}

interface CallParticipant extends User {
  /** True if the host left the room before publish; helps the UX cue. */
  leftEarly?: boolean;
}

interface PublishModalProps {
  open: boolean;
  recordingToken: string;
  /** Optional room code to surface the call's participant history. */
  roomCode?: string;
  initialSelected?: User[];
  initialLinkShared?: boolean;
  onClose: () => void;
  onPublish: (args: {
    userIds: number[];
    isLinkShared: boolean;
  }) => Promise<void> | void;
}

export default function PublishModal({
  open,
  recordingToken,
  roomCode,
  initialSelected = [],
  initialLinkShared = false,
  onClose,
  onPublish,
}: PublishModalProps) {
  const { t } = useTranslation(["recordings", "common"]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>(initialSelected);
  const [callParticipants, setCallParticipants] = useState<CallParticipant[]>(
    [],
  );
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkShared, setLinkShared] = useState(initialLinkShared);
  const [linkCopied, setLinkCopied] = useState(false);

  // Reset internal state when reopened so we don't leak across recordings.
  useEffect(() => {
    if (!open) return;
    setSelected(initialSelected);
    setLinkShared(initialLinkShared);
    setSearch("");
    setResults([]);
    setLinkCopied(false);
  }, [open, initialSelected, initialLinkShared]);

  // Fetch the call's participant history once when opened with a room.
  useEffect(() => {
    if (!open || !roomCode) {
      setCallParticipants([]);
      return;
    }
    let cancelled = false;
    roomApi
      .participantsHistory(roomCode)
      .then((data) => {
        if (cancelled) return;
        setCallParticipants(
          data.results.map((p) => ({
            id: p.id,
            username: p.username,
            full_name: p.full_name,
            leftEarly: !p.is_active,
          })),
        );
      })
      .catch(() => {
        // Likely a 403 (caller is not host) or unknown room. Silently empty.
        if (!cancelled) setCallParticipants([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, roomCode]);

  // Debounced search.
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

  const selectedIds = useMemo(
    () => new Set(selected.map((u) => u.id)),
    [selected],
  );

  const toggle = (u: User) => {
    setSelected((prev) =>
      prev.some((x) => x.id === u.id)
        ? prev.filter((x) => x.id !== u.id)
        : [...prev, u],
    );
  };

  const selectAllParticipants = () => {
    setSelected((prev) => {
      const map = new Map(prev.map((u) => [u.id, u] as const));
      for (const cp of callParticipants) map.set(cp.id, cp);
      return [...map.values()];
    });
  };

  const clearAll = () => setSelected([]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(recordingsApi.watchUrl(recordingToken));
      setLinkCopied(true);
      toast.success(t("recordings:publishModal.linkShareCopied"));
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* clipboard denied — silent */
    }
  };

  const handlePublish = async () => {
    setIsSubmitting(true);
    try {
      await onPublish({
        userIds: selected.map((u) => u.id),
        isLinkShared: linkShared,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <ModalHeader>
        <div>
          <ModalTitle>{t("recordings:publishModal.title")}</ModalTitle>
          <ModalDescription>
            {t("recordings:publishModal.subtitle")}
          </ModalDescription>
        </div>
      </ModalHeader>

      <ModalBody>
        {/* Call participants */}
        {callParticipants.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--t3)] uppercase tracking-wider">
                {t("recordings:publishModal.callParticipants")}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={selectAllParticipants}
                  className="text-[11px] text-[var(--brand-text)] hover:underline bg-transparent border-none cursor-pointer"
                >
                  {t("recordings:publishModal.selectAll")}
                </button>
                <span className="text-[var(--t3)] text-[10px]">·</span>
                <button
                  onClick={clearAll}
                  className="text-[11px] text-[var(--t3)] hover:text-[var(--t1)] hover:underline bg-transparent border-none cursor-pointer"
                >
                  {t("recordings:publishModal.clearAll")}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {callParticipants.map((p) => {
                const checked = selectedIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p)}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-lg border-none cursor-pointer text-start transition-colors",
                      checked
                        ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                        : "bg-transparent text-[var(--t1)] hover:bg-[var(--s3)]",
                    )}
                  >
                    <CheckBox checked={checked} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-medium truncate">
                        {p.full_name || p.username}
                      </span>
                      <span className="block text-[10px] text-[var(--t3)] truncate">
                        @{p.username}
                        {p.leftEarly && (
                          <span className="ms-1 text-[var(--amber)]">
                            · {t("recordings:publishModal.leftEarly")}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Free search */}
        <div className="relative">
          <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--t3)]">
            {Icons.search}
          </span>
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("recordings:publishModal.searchPlaceholder")}
            className="w-full bg-[var(--s3)] border border-[var(--b)] rounded-lg ps-8 pe-3 py-2 text-xs text-[var(--t1)] placeholder-[var(--t3)] outline-none focus:border-[var(--brand)] transition-colors"
          />
          {isSearching && (
            <div className="absolute end-3 top-1/2 -translate-y-1/2">
              <div className="w-3 h-3 border-2 border-[var(--brand)]/30 border-t-[var(--brand)] rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search results */}
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
          {search.trim() && !isSearching && results.length === 0 && (
            <p className="text-xs text-[var(--t3)] text-center py-3">
              {t("recordings:publishModal.noResults")}
            </p>
          )}
          {results.map((u) => {
            const checked = selectedIds.has(u.id);
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
                <CheckBox checked={checked} />
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
            {t("recordings:publishModal.selectedCount", {
              count: selected.length,
            })}
          </div>
        )}

        {/* Link sharing */}
        <div className="border-t border-[var(--b)] pt-3 flex flex-col gap-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={linkShared}
              onChange={(e) => setLinkShared(e.target.checked)}
              className="mt-0.5 accent-[var(--brand)]"
            />
            <span className="flex-1">
              <span className="block text-xs font-semibold text-[var(--t1)]">
                {t("recordings:publishModal.linkShareTitle")}
              </span>
              <span className="block text-[11px] text-[var(--t3)]">
                {t("recordings:publishModal.linkShareDesc")}
              </span>
            </span>
          </label>
          {linkShared && (
            <div className="flex gap-2">
              <code className="flex-1 bg-[var(--s3)] rounded-lg px-3 py-2 text-[11px] text-[var(--t2)] truncate force-ltr">
                {recordingsApi.watchUrl(recordingToken)}
              </code>
              <Button variant="ghost" size="sm" onClick={handleCopyLink}>
                {linkCopied
                  ? t("recordings:publishModal.linkShareCopied")
                  : t("recordings:publishModal.linkShareCopy")}
              </Button>
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("recordings:publishModal.cancel")}
        </Button>
        <Button size="sm" onClick={handlePublish} loading={isSubmitting}>
          {t("recordings:publishModal.publish")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "w-4 h-4 rounded border flex items-center justify-center text-[10px] flex-shrink-0",
        checked
          ? "bg-[var(--brand)] border-[var(--brand)] text-white"
          : "border-[var(--b)]",
      )}
    >
      {checked && "✓"}
    </span>
  );
}
