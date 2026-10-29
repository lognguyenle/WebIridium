import clsx from "clsx";
import styles from "./Menubar.module.css";
import { Menubar as RadixMenubar } from "radix-ui";

import DotFilledIcon from "@/assets/icons/DotFilledIcon.svg?react";
import CheckIcon from "@/assets/icons/CheckIcon.svg?react";

export const MenubarRoot = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <RadixMenubar.Root className={clsx(styles.root, className)}>
      {children}
    </RadixMenubar.Root>
  );
};

export const MenubarMenu = ({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) => {
  return (
    <RadixMenubar.Menu>
      <RadixMenubar.Trigger className={styles.trigger}>
        {name}
      </RadixMenubar.Trigger>
      <RadixMenubar.Portal>
        <RadixMenubar.Content
          className={styles.content}
          align="start"
          sideOffset={3}
          alignOffset={-2}
        >
          {children}
        </RadixMenubar.Content>
      </RadixMenubar.Portal>
    </RadixMenubar.Menu>
  );
};

export const MenubarItem = ({
  name,
  onSelect,
  disabled,
}: {
  name: string;
  onSelect: () => void;
  disabled?: boolean;
}) => {
  return (
    <RadixMenubar.Item
      className={styles.item}
      onSelect={onSelect}
      disabled={disabled}
    >
      {name}
    </RadixMenubar.Item>
  );
};

export const MenubarLinkItem = ({
  name,
  href,
}: {
  name: string;
  href: string;
}) => {
  return (
    <RadixMenubar.Item asChild>
      <a className={styles.item} href={href} target="_blank">
        {name}
      </a>
    </RadixMenubar.Item>
  );
};

export const MenubarRadioGroup = ({
  value,
  onValueChange,
  children,
}: {
  value: string | null;
  onValueChange: (newValue: string) => void;
  children: React.ReactNode;
}) => {
  return (
    <RadixMenubar.RadioGroup
      className={styles.radioGroup}
      value={value ?? undefined}
      onValueChange={onValueChange}
    >
      {children}
    </RadixMenubar.RadioGroup>
  );
};

export const MenubarRadioItem = ({
  value,
  disabled,
  children,
}: {
  value: string | null;
  disabled?: boolean;
  children: React.ReactNode;
}) => {
  return (
    <RadixMenubar.RadioItem
      className={styles.item}
      value={value!}
      disabled={disabled}
    >
      <RadixMenubar.ItemIndicator className={styles.itemIndicator}>
        <DotFilledIcon />
      </RadixMenubar.ItemIndicator>
      {children}
    </RadixMenubar.RadioItem>
  );
};

export const MenubarCheckboxItem = ({
  checked,
  onCheckedChange,
  disabled,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) => {
  return (
    <RadixMenubar.CheckboxItem
      className={styles.item}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
    >
      <RadixMenubar.ItemIndicator className={styles.itemIndicator}>
        <CheckIcon />
      </RadixMenubar.ItemIndicator>
      {children}
    </RadixMenubar.CheckboxItem>
  );
};

export const MenubarSeparator = () => {
  return <RadixMenubar.Separator className={styles.separator} />;
};
