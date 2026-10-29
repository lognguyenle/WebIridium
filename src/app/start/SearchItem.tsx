import type { BiomodelInfo } from "@/features/biomodels";
import styles from "./SearchItem.module.css";
import { biomodelsDateToEnglish } from "@/features/formatUtils";
import PulseLoader from "@/components/PulseLoader";

export interface SearchItemProps {
  info: BiomodelInfo;
  isEmphasizeId: boolean;
  isLoading: boolean;
  onSelect: () => void;
}

const getFirstSentence = (synopysis: string): string =>
  synopysis.slice(0, synopysis.indexOf(".") + 1);

const SearchItem = ({
  info,
  isEmphasizeId,
  isLoading,
  onSelect,
}: SearchItemProps) => {
  return (
    <div className={styles.item}>
      {isLoading && <PulseLoader className={styles.loader} />}
      <button className={styles.main} onClick={onSelect} disabled={isLoading}>
        <h4 className={styles.name}>
          {isEmphasizeId ? info.id : info.name}
          <span className={styles.number}>
            {" "}
            ({isEmphasizeId ? info.name : info.id})
          </span>
        </h4>
        <p className={styles.citation}>
          <span>{info.authors.join(", ")}</span>
          <span> - {info.journal}</span>
          <span>, {biomodelsDateToEnglish(info.date)})</span>
        </p>
        <p className={styles.synopsis}>{getFirstSentence(info.synopsis)}</p>
      </button>
    </div>
  );
};

export default SearchItem;
