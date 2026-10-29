import { useEffect } from "react";
import { Provider, useSetAtom } from "jotai";

import defaultModel from "@/assets/default.ant?raw";

import { setModelAtom } from "@/globals/model";
import { activeProjectFileAtom } from "@/globals/project";
import type { ProjectId } from "@/features/savedData";
import { useAtomValue } from "jotai";
import { graphPresetsAtom } from "@/globals/graphPresets";

const Initialize = ({
  didInitialLoadRef,
  shouldStubActiveFile,
}: {
  didInitialLoadRef: React.RefObject<boolean>;
  shouldStubActiveFile?: boolean;
}) => {
  const setModel = useSetAtom(setModelAtom);

  const setActiveProjectFile = useSetAtom(activeProjectFileAtom);

  useEffect(() => {
    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true;

      const loadWithInitial = async () => {
        // temporary stub for tests until we remove this component and
        // replace with something better
        if (shouldStubActiveFile) {
          setActiveProjectFile("stub" as ProjectId);
          await setModel({
            name: "Starter Model",
            content: defaultModel,
          });
          return;
        }
      };

      void loadWithInitial();
    }
  }, [didInitialLoadRef, setModel, setActiveProjectFile, shouldStubActiveFile]);

  return null;
};

/**
 * Jotai won't load the graph presets until they are mounted. So we have to forcefully mount the graph presets
 * so that they load before any projects.
 */
const UglyMountGraphPresets = () => {
  void useAtomValue(graphPresetsAtom);
  return null;
};

const WorkspaceProvider = ({
  didInitialLoadRef,
  shouldStubActiveFile,
  children,
}: {
  didInitialLoadRef: React.RefObject<boolean>;
  shouldStubActiveFile?: boolean;
  children: React.ReactNode;
}) => {
  return (
    <Provider>
      <Initialize
        didInitialLoadRef={didInitialLoadRef}
        shouldStubActiveFile={shouldStubActiveFile}
      />
      <UglyMountGraphPresets />
      {children}
    </Provider>
  );
};

export default WorkspaceProvider;
