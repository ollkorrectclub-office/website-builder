"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function SubmitButton({
  label,
  pendingLabel,
  variant = "primary",
  testId,
  disabled = false,
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "ghost";
  testId?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} disabled={pending || disabled} data-testid={testId}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
