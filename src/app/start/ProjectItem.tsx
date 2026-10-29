import type { Metadata } from "@/features/savedData";
import styles from "./ProjectItem.module.css";

import ThreeDotsIcon from "@/assets/icons/ThreeDotsIcon.svg?react";
import TrashIcon from "@/assets/icons/TrashIcon.svg?react";

import { timestampToNumericDate } from "@/features/formatUtils";
import { getPropertyFromCssGradient } from "@/features/cssGradients";

import PulseLoader from "@/components/PulseLoader";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "@/components/DropdownMenu";

export interface ProjectItemProps {
  metadata: Metadata;
  isLoading: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const getIconTextFromName = (name: string) => {
  const words = name.split(" ").filter((w) => w[0]?.match(/[a-zA-Z]/g));
  if (words.length === 0) {
    return "M";
  } else if (1 <= words.length && words.length <= 3) {
    return words[0][0].toUpperCase();
  } else {
    return words[0][0].toUpperCase() + words[1][0].toUpperCase();
  }
};

const ProjectItem = ({
  metadata,
  isLoading,
  onSelect,
  onDelete,
}: ProjectItemProps) => {
  return (
    <div className={styles.item}>
      <button className={styles.main} disabled={isLoading} onClick={onSelect}>
        <div
          className={styles.icon}
          style={{
            background: getPropertyFromCssGradient(metadata.icon.color),
          }}
        >
          <span className={styles.iconText}>
            {getIconTextFromName(metadata.name)}
          </span>
        </div>
        <div className={styles.details}>
          <h4 className={styles.name}>{metadata.name}</h4>
          <span className={styles.date}>
            Created: {timestampToNumericDate(metadata.created)}
          </span>
          <span className={styles.date}>
            Updated: {timestampToNumericDate(metadata.updated)}
          </span>
        </div>
      </button>
      <div className={styles.moreContainer}>
        {isLoading ? (
          <PulseLoader className={styles.loader} size="0.3rem" />
        ) : (
          <DropdownMenuRoot>
            <DropdownMenuTrigger>
              <button className={styles.more} aria-label="More">
                <ThreeDotsIcon className={styles.moreIcon} aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                name="Delete"
                onSelect={onDelete}
                icon={<TrashIcon width="1em" height="1em" />}
              />
            </DropdownMenuContent>
          </DropdownMenuRoot>
        )}
      </div>
    </div>
  );
};

export default ProjectItem;
