import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { authApi, type GlobalSearchResult } from "../../features/auth/api/auth.api";
import { Icons } from "../../lib/constants/icons";
import { cn } from "../../lib/utils";

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
}

export default function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const { t, i18n } = useTranslation(["dashboard", "common"]);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search query
  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await authApi.globalSearch(query.trim());
        setResults(data);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, open]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Handle outside click & Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Flatten results for keyboard navigation mapping
  const flattenedItems = useMemo(() => {
    if (!results) return [];
    const items: Array<{
      type: string;
      id: number;
      label: string;
      sublabel?: string;
      link: string;
      icon: React.ReactNode;
    }> = [];

    // Students
    (results.students || []).forEach((s) => {
      items.push({
        type: "student",
        id: s.id,
        label: s.full_name || s.username,
        sublabel: `@${s.username}`,
        link: `/crm/members`,
        icon: Icons.people,
      });
    });

    // Teachers
    (results.teachers || []).forEach((th) => {
      items.push({
        type: "teacher",
        id: th.id,
        label: th.full_name || th.username,
        sublabel: `@${th.username}`,
        link: `/crm/members`,
        icon: Icons.people,
      });
    });

    // Courses
    (results.courses || []).forEach((c) => {
      items.push({
        type: "course",
        id: c.id,
        label: c.name,
        sublabel: c.code,
        link: `/academic/courses`,
        icon: Icons.tools,
      });
    });

    // Classes
    (results.classes || []).forEach((cl) => {
      items.push({
        type: "class",
        id: cl.id,
        label: cl.name,
        sublabel: cl.course_name,
        link: `/academic/classes`,
        icon: Icons.chat,
      });
    });

    // Sessions
    (results.sessions || []).forEach((se) => {
      items.push({
        type: "session",
        id: se.id,
        label: se.title,
        sublabel: `${se.status}${se.room_code ? ` (${se.room_code})` : ""}`,
        link: se.room_code ? `/room/${se.room_code}` : `/academic/sessions`,
        icon: Icons.camera,
      });
    });

    // Assessments
    (results.assessments || []).forEach((a) => {
      items.push({
        type: "assessment",
        id: a.id,
        label: a.title,
        sublabel: a.is_published ? "Published" : "Draft",
        link: `/academic/assessments`,
        icon: Icons.exam,
      });
    });

    // Invoices
    (results.invoices || []).forEach((inv) => {
      items.push({
        type: "invoice",
        id: inv.id,
        label: inv.invoice_number,
        sublabel: `${inv.student_name} · ${inv.amount} · ${inv.status}`,
        link: `/finance/ledger`,
        icon: Icons.barChart,
      });
    });

    return items;
  }, [results]);

  // Adjust activeIndex if flattened items count changes
  useEffect(() => {
    setActiveIndex(0);
  }, [flattenedItems.length]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (flattenedItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flattenedItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + flattenedItems.length) % flattenedItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const activeItem = flattenedItems[activeIndex];
      if (activeItem) {
        navigate(activeItem.link);
        onClose();
      }
    }
  };

  if (!open) return null;

  const handleItemClick = (link: string) => {
    navigate(link);
    onClose();
  };

  const isRtl = i18n.language === "fa";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 md:p-20 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        dir={isRtl ? "rtl" : "ltr"}
        className={cn(
          "w-full max-w-2xl bg-[var(--s2)] border border-[var(--b)] rounded-xl shadow-2xl overflow-hidden flex flex-col",
          "animate-in zoom-in-95 slide-in-from-top-4 duration-200"
        )}
      >
        {/* Search Input Box */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--b)] bg-[var(--s1)]">
          <span className="text-[var(--t3)] flex-shrink-0 [&>svg]:w-5 [&>svg]:h-5">
            {Icons.search}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("topbar.searchPlaceholder", "Search students, teachers, courses, classes...")}
            className="flex-1 bg-transparent border-none text-[var(--t1)] placeholder-[var(--t3)] text-sm focus:outline-none"
          />
          {loading && (
            <span className="w-4 h-4 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          {query && !loading && (
            <button
              onClick={() => setQuery("")}
              className="text-xs text-[var(--t3)] hover:text-[var(--t1)] bg-transparent border-none cursor-pointer p-1"
            >
              ×
            </button>
          )}
          <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded bg-[var(--s3)] border border-[var(--b)] text-[var(--t3)]">
            ESC
          </span>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto max-h-[60vh] p-3 flex flex-col gap-4">
          {query.trim().length < 2 && (
            <div className="text-center py-8 px-4 flex flex-col gap-2">
              <span className="text-xl text-[var(--t3)]" aria-hidden>
                🔍
              </span>
              <p className="text-xs font-semibold text-[var(--t2)]">
                {t("topbar.searchMinLength", "Type at least 2 characters to search...")}
              </p>
              <p className="text-[10px] text-[var(--t3)]">
                {t("topbar.searchInstruction", "Use ↑↓ to navigate, Enter to select, Esc to close")}
              </p>
            </div>
          )}

          {query.trim().length >= 2 && !loading && flattenedItems.length === 0 && (
            <div className="text-center py-8 px-4 flex flex-col gap-2">
              <span className="text-xl text-[var(--t3)]" aria-hidden>
                📭
              </span>
              <p className="text-xs font-semibold text-[var(--t2)]">
                {t("topbar.searchEmpty", { query })}
              </p>
            </div>
          )}

          {flattenedItems.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {/* Flattened List rendering */}
              <ul className="flex flex-col gap-0.5">
                {flattenedItems.map((item, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <li key={`${item.type}-${item.id}`}>
                      <button
                        onClick={() => handleItemClick(item.link)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={cn(
                          "w-full text-start px-3 py-2.5 rounded-lg border-none cursor-pointer transition-all duration-150 flex items-center gap-3",
                          isActive
                            ? "bg-[var(--brand)] text-white"
                            : "bg-transparent text-[var(--t1)] hover:bg-[var(--s3)]"
                        )}
                      >
                        <span
                          className={cn(
                            "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4",
                            isActive ? "bg-white/20 text-white" : "bg-[var(--s3)] text-[var(--t2)]"
                          )}
                        >
                          {item.icon}
                        </span>
                        <div className="flex-1 min-w-0 flex flex-col">
                          <span className="text-xs font-semibold truncate">
                            {item.label}
                          </span>
                          {item.sublabel && (
                            <span
                              className={cn(
                                "text-[10px] truncate mt-0.5",
                                isActive ? "text-white/80" : "text-[var(--t3)]"
                              )}
                            >
                              {item.sublabel}
                            </span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase",
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-[var(--s3)] text-[var(--t3)]"
                          )}
                        >
                          {item.type}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
