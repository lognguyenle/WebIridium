import clsx from "clsx";

import styles from "./Dialog.module.css";
import buttonStyles from "@/components/Button.module.css";

import { Dialog as RadixDialog, VisuallyHidden } from "radix-ui";

import CrossIcon from "@/assets/icons/CrossIcon.svg?react";

export interface DialogProps {
  title: string;
  description: string;
  /* default: true */
  showDescription?: boolean;
  onClose: () => void;

  children?: React.ReactNode;
  className?: string;
}

const Dialog = ({
  title,
  description,
  showDescription = true,
  onClose,
  children,
  className,
}: DialogProps) => {
  const descriptionElement = (
    <RadixDialog.Description className={styles.description}>
      {description}
    </RadixDialog.Description>
  );

  return (
    <RadixDialog.Root
      defaultOpen={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content className={clsx(styles.dialog, className)}>
          <div className={styles.top}>
            <RadixDialog.Title className={styles.title}>
              {title}
            </RadixDialog.Title>

            <RadixDialog.Close
              className={clsx(buttonStyles.ghost, styles.close)}
            >
              <CrossIcon />
            </RadixDialog.Close>
          </div>

          {showDescription ? (
            descriptionElement
          ) : (
            <VisuallyHidden.Root>{descriptionElement}</VisuallyHidden.Root>
          )}

          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

export default Dialog;
