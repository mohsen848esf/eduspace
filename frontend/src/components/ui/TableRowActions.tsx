import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Edit2, Trash2, MoreHorizontal, type LucideIcon } from "lucide-react";
import { Tooltip } from "./Tooltip";
import { cn } from "../../lib/utils";

export interface TableAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode | LucideIcon;
  variant?: "danger" | "warning" | "success" | "info" | "default";
  // If true, it is treated as a primary edit action
  isEdit?: boolean;
  // If true, it is treated as a primary delete action
  isDelete?: boolean;
}

interface TableRowActionsProps {
  actions: TableAction[];
  align?: "start" | "center" | "end";
  isFarsi?: boolean;
}

export function TableRowActions({ actions, align = "end", isFarsi = false }: TableRowActionsProps) {
  // Find primary edit and delete actions
  const editAction = actions.find((a) => a.isEdit || a.label.toLowerCase().includes("edit") || a.label.includes("ویرایش"));
  const deleteAction = actions.find((a) => a.isDelete || a.label.toLowerCase().includes("delete") || a.label.toLowerCase().includes("remove") || a.label.includes("حذف"));

  // The rest of the actions go into the dropdown
  const dropdownActions = actions.filter((a) => a !== editAction && a !== deleteAction);

  const renderIcon = (action: TableAction, defaultIcon: LucideIcon) => {
    const icon = action.icon || defaultIcon;
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    return React.createElement(
      icon as React.ElementType<{ className?: string }>,
      { className: "w-3.5 h-3.5" },
    );
  };

  return (
    <div className={cn("flex items-center gap-1", isFarsi ? "justify-start" : "justify-end")} dir={isFarsi ? "rtl" : "ltr"}>
      {/* Primary Edit Action */}
      {editAction && (
        <Tooltip content={editAction.label}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              editAction.onClick();
            }}
            className={cn(
              "p-1.5 rounded-lg border-none bg-transparent cursor-pointer transition-all duration-150 scale-95 hover:scale-105",
              "text-[var(--cyan)] hover:bg-[rgba(6,182,212,0.1)] focus:bg-[rgba(6,182,212,0.1)]"
            )}
            aria-label={editAction.label}
          >
            {renderIcon(editAction, Edit2)}
          </button>
        </Tooltip>
      )}

      {/* Primary Delete Action */}
      {deleteAction && (
        <Tooltip content={deleteAction.label}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteAction.onClick();
            }}
            className={cn(
              "p-1.5 rounded-lg border-none bg-transparent cursor-pointer transition-all duration-150 scale-95 hover:scale-105",
              "text-[var(--red)] hover:bg-[rgba(239,68,68,0.1)] focus:bg-[rgba(239,68,68,0.1)]"
            )}
            aria-label={deleteAction.label}
          >
            {renderIcon(deleteAction, Trash2)}
          </button>
        </Tooltip>
      )}

      {/* More Actions Dropdown */}
      {dropdownActions.length > 0 && (
        <DropdownMenu.Root dir={isFarsi ? "rtl" : "ltr"}>
          <DropdownMenu.Trigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "p-1.5 rounded-lg border-none bg-transparent cursor-pointer transition-all duration-150",
                "text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[rgba(255,255,255,0.05)]"
              )}
              aria-label={isFarsi ? "عملیات بیشتر" : "More Actions"}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align={align}
              sideOffset={4}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "z-50 min-w-[140px] p-1 rounded-xl shadow-2xl border border-white/10",
                "bg-[var(--s2)] text-[var(--t1)] select-none",
                "animate-in fade-in-0 slide-in-from-top-1 duration-100",
                isFarsi ? "text-right" : "text-left"
              )}
            >
              {dropdownActions.map((action, idx) => {
                const IconComp = action.icon;
                return (
                  <DropdownMenu.Item
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick();
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg outline-none cursor-pointer transition-colors",
                      action.variant === "danger"
                        ? "text-[var(--red)] hover:bg-[rgba(239,68,68,0.1)]"
                        : action.variant === "warning"
                        ? "text-[var(--amber)] hover:bg-[rgba(245,158,11,0.1)]"
                        : action.variant === "success"
                        ? "text-[var(--green)] hover:bg-[rgba(34,197,94,0.1)]"
                        : "text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[rgba(255,255,255,0.05)]"
                    )}
                  >
                    {IconComp ? (
                      React.isValidElement(IconComp) ? (
                        IconComp
                      ) : (
                        React.createElement(
                          IconComp as React.ElementType<{ className?: string }>,
                          { className: "w-3.5 h-3.5 flex-shrink-0" },
                        )
                      )
                    ) : null}
                    <span className="truncate">{action.label}</span>
                  </DropdownMenu.Item>
                );
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </div>
  );
}
