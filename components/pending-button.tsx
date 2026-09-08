"use client";
import { useFormStatus } from "react-dom";
export function PendingButton({
  children,
  pendingLabel = "Saving…",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending || disabled}>
      {pending ? pendingLabel : children}
    </button>
  );
}
