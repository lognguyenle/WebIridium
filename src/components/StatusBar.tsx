import clsx from "clsx";
import styles from "./StatusBar.module.css";

export interface StatusBarProps {
  children: React.ReactNode;
}

export const StatusBar = ({ children }: StatusBarProps) => {
  return <div className={styles.root}>{children}</div>;
};

export interface StatusBarItemProps {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
}

export const StatusBarItem = ({
  children,
  className,
  align = "start",
}: StatusBarItemProps) => {
  return (
    <div className={clsx(styles.item, styles[align], className)}>
      {children}
    </div>
  );
};
