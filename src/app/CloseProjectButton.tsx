import { useState } from "react";
import styles from "./CloseProjectButton.module.css";

import IconButton from "@/components/IconButton";

import ExitIcon from "@/assets/icons/ExitIcon.svg?react";
import CheckIcon from "@/assets/icons/CheckIcon.svg?react";

export interface CloseProjectButtonProps {
  onClose: () => void;
}

const CONFIRM_DURATION = 5_000;

const CloseProjectButton = ({ onClose }: CloseProjectButtonProps) => {
  const [confirming, setConfirming] = useState(false);

  const handleStart = () => {
    setConfirming(true);
    setTimeout(() => {
      setConfirming(false);
    }, CONFIRM_DURATION);
  };

  return confirming ? (
    <button className={styles.confirm} onClick={onClose}>
      Confirm close project{" "}
      <CheckIcon className={styles.check} width="1em" height="1em" />{" "}
    </button>
  ) : (
    <IconButton label="Close Project" onClick={handleStart}>
      <ExitIcon width="1em" height="1em" />
    </IconButton>
  );
};

export default CloseProjectButton;
