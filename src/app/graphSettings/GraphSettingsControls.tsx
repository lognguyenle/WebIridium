import { useMemo, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import styles from "./GraphSettingsControls.module.css";
import {
  addGraphPresetAtom,
  builtinGraphPresets,
  currentPresetAtom,
  defaultGraphSettings,
  deleteGraphPresetAtom,
  graphPresetsAtom,
  PROJECT_PRESET_NAME,
  renameGraphPresetAtom,
  updateCurrentPresetAtom,
  updateGraphSettingsAtom,
} from "@/globals/graphPresets";

import PlusIcon from "@/assets/icons/PlusIcon.svg?react";
import PencilIcon from "@/assets/icons/PencilIcon.svg?react";
import TrashIcon from "@/assets/icons/TrashIcon.svg?react";
import ResetIcon from "@/assets/icons/ResetIcon.svg?react";
import ThreeDotsIcon from "@/assets/icons/ThreeDotsIcon.svg?react";
import Select from "@/components/input/Select";
import IconButton from "@/components/IconButton";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "@/components/DropdownMenu";
import { useToast } from "@/components/Toast";
import { errorToDisplayString } from "@/features/formatUtils";

const GraphSettingsControls = () => {
  const currentPreset = useAtomValue(currentPresetAtom);
  const updateCurrentPreset = useSetAtom(updateCurrentPresetAtom);
  const graphPresets = useAtomValue(graphPresetsAtom);
  const updateGraphSettings = useSetAtom(updateGraphSettingsAtom);
  const renameGraphPreset = useSetAtom(renameGraphPresetAtom);
  const deleteGraphPreset = useSetAtom(deleteGraphPresetAtom);
  const addGraphPreset = useSetAtom(addGraphPresetAtom);
  const { toast } = useToast();

  const isUserMade = Object.hasOwn(graphPresets.user, currentPreset);

  const groups = useMemo(() => {
    const result: Record<string, Record<string, string>> = {
      Project: {
        [PROJECT_PRESET_NAME]: PROJECT_PRESET_NAME,
      },
      "Builtin (Shared)": Object.fromEntries(
        Object.keys(graphPresets.builtins).map((v) => [v, v]),
      ),
    };

    if (Object.keys(graphPresets.user).length > 0) {
      result["User (Shared)"] = Object.fromEntries(
        Object.keys(graphPresets.user).map((v) => [v, v]),
      );
    }

    return result;
  }, [graphPresets]);

  const [renamingTo, setRenamingTo] = useState<string>();
  const renameInputRef = useRef<HTMLInputElement>(null);

  const handleRename = () => {
    setRenamingTo(currentPreset);

    // fix dropdown closing stealing focus
    // https://github.com/radix-ui/primitives/issues/3106
    setTimeout(() => {
      renameInputRef.current?.focus();
    }, 100);
  };

  const finishRename = () => {
    if (renamingTo) {
      try {
        const err = renameGraphPreset({
          oldName: currentPreset,
          newName: renamingTo,
        });

        if (err) {
          toast({
            type: "error",
            title:
              err === "cantRename"
                ? "Can't rename this preset."
                : err === "invalidName"
                  ? "Invalid name"
                  : "Name already taken.",
            description:
              err === "cantRename"
                ? "You can only rename user-made presets."
                : err === "invalidName"
                  ? "Names must be at most 20 characters."
                  : "You cannot have duplicate names.",
          });
        }
      } catch (err) {
        toast({
          type: "error",
          title: "Failed to rename",
          description: errorToDisplayString(err),
        });
      }
    }

    setRenamingTo(undefined);
  };

  const handleReset = () => {
    const builtin = builtinGraphPresets[currentPreset];
    if (builtin) {
      updateGraphSettings(builtin);
    } else {
      updateGraphSettings(defaultGraphSettings);
    }
  };

  const handleDelete = () => {
    try {
      deleteGraphPreset(currentPreset);
    } catch (err) {
      toast({
        type: "error",
        title: "Failed to delete",
        description: errorToDisplayString(err),
      });
    }
  };

  return (
    <div className={styles.controls}>
      <label htmlFor="graphPreset" className={styles.presetLabel}>
        Preset
      </label>

      {renamingTo !== undefined ? (
        <input
          id="rename-graph-preset"
          ref={renameInputRef}
          type="text"
          placeholder="Preset Name"
          className={styles.rename}
          autoFocus
          autoComplete="off"
          value={renamingTo}
          onChange={(e) => setRenamingTo(e.target.value)}
          onBlur={finishRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void finishRename();
            } else if (e.key === "Escape") {
              // cancel
              setRenamingTo(undefined);
            }
          }}
        />
      ) : (
        <Select
          name="graphPreset"
          value={currentPreset}
          className={styles.presetSelect}
          groups={groups}
          onChange={updateCurrentPreset}
        />
      )}

      <IconButton label="Add" onClick={addGraphPreset}>
        <PlusIcon width="1em" height="1em" />
      </IconButton>
      <DropdownMenuRoot>
        <DropdownMenuTrigger>
          <IconButton label="Options">
            <ThreeDotsIcon width="1em" height="1em" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            name="Rename"
            onSelect={handleRename}
            disabled={!isUserMade}
            icon={<PencilIcon width="1em" height="1em" />}
          />
          <DropdownMenuItem
            name="Reset to Default"
            onSelect={handleReset}
            icon={<ResetIcon width="1em" height="1em" />}
          />
          <DropdownMenuItem
            name="Delete"
            onSelect={handleDelete}
            disabled={!isUserMade}
            icon={<TrashIcon width="1em" height="1em" />}
          />
        </DropdownMenuContent>
      </DropdownMenuRoot>
    </div>
  );
};

export default GraphSettingsControls;
