import styles from "./StartPanel.module.css";
import ProjectSection from "./ProjectSection.tsx";
import SearchSection from "./SearchSection.tsx";

const StartPanel = () => {
  return (
    <div className={styles.panel}>
      <ProjectSection />
      <SearchSection />
    </div>
  );
};

export default StartPanel;
