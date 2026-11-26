import { Button, Dialog, Input } from "@qrtz/ui";
import { useEffect, useId, useState } from "react";

/** Asks for one value. `onSubmit` returns an error message to keep the dialog open, or undefined. */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  label,
  initialValue,
  confirmLabel,
  onSubmit,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly label: string;
  readonly initialValue: string;
  readonly confirmLabel: string;
  readonly onSubmit: (value: string) => Promise<string | undefined>;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | undefined>();
  const inputId = useId();

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError(undefined);
    }
  }, [open, initialValue]);

  const submit = async () => {
    const message = await onSubmit(value);
    if (message === undefined) onOpenChange(false);
    else setError(message);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{confirmLabel}</Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={inputId} className="mb-1.5 block font-medium">
          {label}
        </label>
        <Input
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={error !== undefined}
          autoFocus
        />
        {error === undefined ? null : <p className="mt-2 text-destructive">{error}</p>}
      </form>
    </Dialog>
  );
}
