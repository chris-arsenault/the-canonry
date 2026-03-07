import { useMemo } from "react";

export interface TabDefinition {
  id: string;
  label: string;
  indicator?: string;
  align?: string;
}

export function useTabs(
  isComplete: boolean,
  versionCount: number,
  activeTab: string,
  setActiveTab: (tab: string) => void,
) {
  const tabs: TabDefinition[] = useMemo(() => {
    if (isComplete) {
      return [
        { id: "historian", label: "Historian" },
        { id: "enrichment", label: "Enrichment" },
        { id: "images", label: "Images" },
        { id: "reference", label: "Reference" },
        { id: "content", label: "Content", align: "right" },
      ];
    }
    return [
      { id: "pipeline", label: "Pipeline" },
      {
        id: "versions",
        label: "Versions",
        indicator: versionCount > 1 ? `(${versionCount})` : undefined,
      },
      { id: "images", label: "Images" },
      { id: "reference", label: "Reference" },
      { id: "content", label: "Content", align: "right" },
    ];
  }, [isComplete, versionCount]);

  // If the active tab doesn't exist in the current tab set, fall back to
  // the first tab. This handles switching between complete/assembly chronicles
  // when the user was on a tab unique to one set (e.g. "historian" or "pipeline").
  // Shared tabs like "images" survive the switch without resetting.
  const validTab = tabs.find((t) => t.id === activeTab) ? activeTab : tabs[0].id;
  if (validTab !== activeTab) setActiveTab(validTab);

  return { tabs, activeTab, setActiveTab };
}
