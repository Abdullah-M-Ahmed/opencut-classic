"use client";

import {
  TAB_KEYS,
  tabs,
  useAssetsPanelStore,
} from "@/components/editor/panels/assets/assets-panel-store";

// Horizontal tool strip based on the desktop editing workflow.
// Keep the original store and tab components: selecting a tab still opens
// OpenCut's real media, sound, text, sticker and effect panels.
export function TabBar() {
  const { activeTab, setActiveTab } = useAssetsPanelStore();

  return (
    <nav aria-label="Editor tools" className="desktop-tools-nav">
      {TAB_KEYS.map((tabKey) => {
        const tab = tabs[tabKey];
        const active = activeTab === tabKey;
        const label = tabKey === "sounds" ? "Audio"
          : tabKey === "adjustment" ? "Adjust"
          : tabKey === "transitions" ? "Transition"
          : tab.label;

        return (
          <button
            key={tabKey}
            type="button"
            className={`desktop-tool-tab ${active ? "is-active" : ""}`}
            aria-label={tab.label}
            aria-pressed={active}
            title={tab.label}
            onClick={() => setActiveTab(tabKey)}
          >
            <tab.icon className="size-[18px]" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
