import { useTranslation } from "react-i18next";
import Button, { type ButtonVariant } from "./Button";
import {
  Modal,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "./Modal";

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  /**
   * If true, the user must explicitly click confirm/cancel — backdrop
   * click and Escape do nothing. Use for destructive flows.
   */
  blocking?: boolean;
}

/**
 * Drop-in replacement for `window.confirm` with proper styling, focus
 * management, and i18n. Defaults to a destructive (red) confirm button.
 */
export default function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmVariant = "danger",
  onConfirm,
  isLoading = false,
  blocking = false,
}: ConfirmModalProps) {
  const { t } = useTranslation("common");

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      dismissable={!blocking && !isLoading}
      panelClassName="max-w-sm"
    >
      <ModalHeader>
        <div>
          <ModalTitle>{title}</ModalTitle>
          {description && <ModalDescription>{description}</ModalDescription>}
        </div>
      </ModalHeader>
      <ModalFooter>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={isLoading}
        >
          {cancelLabel ?? t("actions.cancel")}
        </Button>
        <Button
          variant={confirmVariant}
          size="sm"
          loading={isLoading}
          onClick={async () => {
            await onConfirm();
          }}
        >
          {confirmLabel ?? t("actions.confirm")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
