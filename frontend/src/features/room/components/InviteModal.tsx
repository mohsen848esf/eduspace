import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Icons } from "../../../lib/constants/icons";
import { Tooltip } from "../../../components/ui/Tooltip";
import { cn } from "../../../lib/utils";
import { useRoomStore } from "../store/roomStore";
import client from "../../../lib/api/client";
import toast from "react-hot-toast";

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

interface InviteModalProps {
  onClose: () => void;
}

export default function InviteModal({ onClose }: InviteModalProps) {
  const { t } = useTranslation("room");
  const { roomCode } = useRoomStore();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [invited, setInvited] = useState<Set<number>>(new Set());
  const [linkCopied, setLinkCopied] = useState(false);
  const [inviting, setInviting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inviteLink = `${window.location.origin}/room/${roomCode}`;

  // Search users
  useEffect(() => {
    if (!search.trim()) {
      setUsers([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await client.get(`/auth/search/?q=${search}`);
        setUsers(res.data);
      } catch {
        setUsers([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [search]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    toast.success(t("invite.copiedToast"));

    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const sendInvite = async (user: User) => {
    const userId = user.id;
    setInviting(userId);
    setError(null);
    try {
      await client.post(`/rooms/${roomCode}/invite/`, { user_id: userId });
      toast.success(t("invite.invitedToast", { username: user.username }));

      setInvited((prev) => new Set(prev).add(userId));
    } catch (err: any) {
      toast.error(t("invite.failed"));
      setError(err.response?.data?.error || t("invite.failed"));
    } finally {
      setInviting(null);
    }
  };

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  const gradients = [
    "from-[#6366f1] to-[#38bdf8]",
    "from-[#22c55e] to-[#38bdf8]",
    "from-[#f59e0b] to-[#f87171]",
    "from-[#e879f9] to-[#6366f1]",
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm bg-[var(--s2)] rounded-2xl border border-[var(--b)] shadow-2xl fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--b)]">
            <span className="text-sm font-semibold text-[var(--t1)]">
              {t("invite.title")}
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-transparent border-none cursor-pointer text-[var(--t3)] hover:bg-[var(--s3)] hover:text-[var(--t1)] flex items-center justify-center transition-all"
            >
              ✕
            </button>
          </div>

          <div className="p-4 flex flex-col gap-4">
            {/* Share link */}
            <div>
              <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider mb-2">
                {t("invite.shareLink")}
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-[var(--s3)] rounded-lg px-3 py-2 text-xs text-[var(--t2)] font-mono truncate">
                  {inviteLink}
                </div>
                <Tooltip
                  content={
                    linkCopied ? t("invite.copied") : t("invite.copy")
                  }
                >
                  <button
                    onClick={copyLink}
                    className={cn(
                      "px-3 py-2 rounded-lg border-none cursor-pointer text-xs font-semibold transition-all",
                      linkCopied
                        ? "bg-[var(--green)]/15 text-[var(--green)]"
                        : "bg-[var(--brand)] text-white hover:bg-[var(--brand-h)]",
                    )}
                  >
                    {linkCopied ? t("invite.copied") : t("invite.copy")}
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Search */}
            <div>
              <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider mb-2">
                {t("invite.inviteByUsername")}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t3)]">
                  {Icons.search}
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("invite.searchPlaceholder")}
                  autoFocus
                  className="w-full bg-[var(--s3)] border border-[var(--b)] rounded-lg pl-8 pr-3 py-2 text-xs text-[var(--t1)] placeholder-[var(--t3)] outline-none focus:border-[var(--brand)] transition-colors"
                />
                {error && (
                  <p className="text-[10px] text-[var(--red)] mt-1">{error}</p>
                )}
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-3 h-3 border-2 border-[var(--brand)]/30 border-t-[var(--brand)] rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Results */}
              {users.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[var(--s3)] transition-colors"
                    >
                      <div
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 bg-gradient-to-br",
                          gradients[user.id % gradients.length],
                        )}
                      >
                        {getInitials(user.full_name || user.username)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[var(--t1)] truncate">
                          {user.full_name || user.username}
                        </div>
                        <div className="text-[10px] text-[var(--t3)]">
                          @{user.username}
                        </div>
                      </div>
                      <button
                        onClick={() => sendInvite(user)}
                        disabled={invited.has(user.id) || inviting === user.id}
                        className={cn(
                          "text-[10px] font-semibold px-2.5 py-1 rounded-lg border-none cursor-pointer transition-all flex items-center gap-1",
                          invited.has(user.id)
                            ? "bg-[var(--green)]/15 text-[var(--green)] cursor-default"
                            : "bg-[var(--brand)] text-white hover:bg-[var(--brand-h)] disabled:opacity-60",
                        )}
                      >
                        {inviting === user.id ? (
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : invited.has(user.id) ? (
                          t("invite.invited")
                        ) : (
                          t("invite.invite")
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {search.trim() && !isSearching && users.length === 0 && (
                <div className="mt-2 text-center py-4">
                  <p className="text-xs text-[var(--t3)]">
                    {t("invite.noUsers")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
