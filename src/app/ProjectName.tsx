import { useRef, useState } from "react";
import styles from "./ProjectName.module.css";
import PencilIcon from "@/assets/icons/PencilIcon.svg?react";
import type { Metadata } from "@/features/savedData";
import IconButton from "@/components/IconButton";
import CrossIcon from "@/assets/icons/CrossIcon.svg?react";
import CheckIcon from "@/assets/icons/CheckIcon.svg?react";

export interface ProjectNameProps {
  metadata: Metadata;
  onNameChange: (newName: string) => void;
}

const ProjectName = ({ metadata, onNameChange }: ProjectNameProps) => {
  const [input, setInput] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleBlur = () => {
    setInput(null);
  };

  const confirm = () => {
    const input = inputRef.current;
    if (input) {
      onNameChange(input.value);
      input.blur();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    if (e.key === "Escape") {
      input.blur();
    } else if (e.key === "Enter") {
      confirm();
    }
  };

  return (
    <div className={styles.main}>
      {input === null ? (
        <button
          className={styles.trigger}
          onClick={() => setInput(metadata.name)}
        >
          <span className={styles.name}>{metadata.name}</span>
          <PencilIcon className={styles.pencilIcon} width="1em" height="1em" />
        </button>
      ) : (
        <div className={styles.inputContainer}>
          <input
            ref={inputRef}
            id="project-name"
            type="text"
            placeholder="Project Name"
            className={styles.input}
            autoFocus
            autoComplete="off"
            value={input}
            onFocus={(e) => e.target.select()}
            onBlur={handleBlur}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <IconButton
            label="Confirm"
            onClick={confirm}
            onPointerDown={(e) => e.preventDefault()}
          >
            <CheckIcon width="1em" height="1em" />
          </IconButton>
          <IconButton
            label="Cancel"
            onClick={() => inputRef?.current?.blur()}
            onPointerDown={(e) => e.preventDefault()}
          >
            <CrossIcon width="1em" height="1em" />
          </IconButton>
        </div>
      )}
    </div>
  );
};

export default ProjectName;
