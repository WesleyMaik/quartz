import { Button, Icon } from "@qrtz/ui";
import { Settings01Icon } from "@qrtz/ui/icons";
import { useState } from "react";
import { SettingsDialog } from "./settings-dialog";

/** Opens Settings. `compact` shows only the icon, for tight headers. */
export function SettingsButton({ compact = false }: { readonly compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {compact ? (
        <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => setOpen(true)}>
          <Icon icon={Settings01Icon} />
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pressable flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md px-3 text-left text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        >
          <Icon icon={Settings01Icon} size={15} />
          Settings
        </button>
      )}
      {open ? <SettingsDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
