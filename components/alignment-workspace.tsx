"use client";
import { useRef, useState } from "react";
import { AlignmentCommandCentre } from "./alignment-command-centre";
import { AlignmentConversation } from "./alignment-conversation";
type ConversationProps = React.ComponentProps<typeof AlignmentConversation>;
type Command = React.ComponentProps<typeof AlignmentCommandCentre>["command"];
export function AlignmentWorkspace({
  command,
  conversation,
}: {
  command: Command;
  conversation: ConversationProps;
}) {
  const [view, setView] = useState(
    conversation.hasStrategy ? "strategy" : "refine",
  );
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const change = (next: string) => {
    setView(next);
  };
  return (
    <div className="area-workspace">
      <div
        className="area-view-switch"
        role="tablist"
        aria-label="Life area view"
      >
        {[
          { id: "strategy", label: "Overview" },
          { id: "refine", label: "Refine direction" },
        ].map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            id={`${tab.id}-tab`}
            role="tab"
            tabIndex={view === tab.id ? 0 : -1}
            aria-selected={view === tab.id}
            aria-controls={`${tab.id}-panel`}
            onClick={() => change(tab.id)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const next =
                  e.key === "Home" ? 0 : e.key === "End" ? 1 : 1 - index;
                change(next ? "refine" : "strategy");
                tabs.current[next]?.focus();
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id="strategy-panel"
        role="tabpanel"
        aria-labelledby="strategy-tab"
        hidden={view !== "strategy"}
      >
        <AlignmentCommandCentre
          command={command}
          onRefine={() => change("refine")}
        />
      </div>
      <div
        id="refine-panel"
        role="tabpanel"
        aria-labelledby="refine-tab"
        hidden={view !== "refine"}
      >
        <AlignmentConversation {...conversation} />
      </div>
    </div>
  );
}
