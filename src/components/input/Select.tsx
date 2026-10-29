import clsx from "clsx";
import { Select as RadixSelect } from "radix-ui";
import styles from "./Select.module.css";
import ChevronDownIcon from "@/assets/icons/ChevronDownIcon.svg?react";
import CheckIcon from "@/assets/icons/CheckIcon.svg?react";

export type SelectProps = {
  name: string;
  value: string;
  onChange: (newValue: string) => void;
  className?: string;
  disabled?: boolean;
  // display name -> value
  readonly options?: { [name: string]: string };
  // group name -> display name -> value
  readonly groups?: { [group: string]: { [name: string]: string } };
  "aria-label"?: string;
};

const SelectItem = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: string;
}) => {
  return (
    <RadixSelect.Item value={value} className={styles.item}>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className={styles.itemIndicator}>
        <CheckIcon />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
};

const Select = (props: SelectProps) => {
  const {
    name,
    value,
    disabled,
    onChange,
    className,
    "aria-label": ariaLabel,
  } = props;

  return (
    <RadixSelect.Root value={value} onValueChange={onChange}>
      <RadixSelect.Trigger
        id={name}
        className={clsx(className, styles.trigger)}
        disabled={disabled}
        aria-label={ariaLabel}
        data-value={value} // this is used for testing b/c I couldn't find any other way to get the value externally
      >
        <RadixSelect.Value placeholder={name} />
        <RadixSelect.Icon className={styles.triggerIcon}>
          <ChevronDownIcon />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className={styles.content}>
          <RadixSelect.ScrollUpButton
            className={styles.scrollButton}
            style={{ transform: "rotate(180deg)" }}
          >
            <ChevronDownIcon />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport>
            {props.options &&
              Object.entries(props.options).map(([name, value]) => (
                <SelectItem key={value} value={value}>
                  {name}
                </SelectItem>
              ))}

            {props.groups &&
              Object.entries(props.groups).map(([group, options]) => (
                <RadixSelect.Group key={group}>
                  <RadixSelect.Label className={styles.label}>
                    {group}
                  </RadixSelect.Label>
                  {Object.entries(options).map(([name, value]) => (
                    <SelectItem key={value} value={value}>
                      {name}
                    </SelectItem>
                  ))}
                </RadixSelect.Group>
              ))}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className={styles.scrollButton}>
            <ChevronDownIcon />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
};

export default Select;
