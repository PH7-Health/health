"use client";
import { useState } from "react";
import { saveReflectionAction } from "@/app/(app)/actions";
export function SaveReflection({ initial }: { initial: string | null }) {
  const [text, setText] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  return (
    <form
      className="reflection-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setStatus("");
        try {
          const d = new FormData();
          d.set("reflection", text);
          await saveReflectionAction(d);
          setStatus(
            "Reflection saved to this week. Your strategy has not been changed.",
          );
        } catch {
          setStatus(
            "Could not confirm the save. Your reflection is still here; try again.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        What will you keep, change, or leave alone?
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="One useful decision is enough."
        />
      </label>
      <button disabled={busy}>{busy ? "Saving…" : "Save reflection"}</button>
      {status && <p role="status">{status}</p>}
    </form>
  );
}
