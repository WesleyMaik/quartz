import type { MessageId } from "@qrtz/messages";
import { Button, cn, Dialog, Icon } from "@qrtz/ui";
import { Cancel01Icon, Database01Icon, Pdf01Icon, SourceCodeIcon } from "@qrtz/ui/icons";
import { type ComponentType, useState } from "react";
import { useIntl } from "react-intl";
import { DataSettings } from "./data-settings";
import { EditorSettings } from "./editor-settings";
import { PdfSettings } from "./pdf-settings";

type SectionId = "editor" | "pdf" | "data";

const SECTIONS: readonly {
  readonly id: SectionId;
  readonly label: MessageId;
  readonly icon: typeof SourceCodeIcon;
  readonly content: ComponentType;
}[] = [
  { id: "editor", label: "settings.section.editor", icon: SourceCodeIcon, content: EditorSettings },
  { id: "pdf", label: "settings.section.pdf", icon: Pdf01Icon, content: PdfSettings },
  { id: "data", label: "settings.section.data", icon: Database01Icon, content: DataSettings },
];

export function SettingsDialog({ onClose }: { readonly onClose: () => void }) {
  const [active, setActive] = useState<SectionId>("editor");
  const intl = useIntl();
  const section = SECTIONS.find((item) => item.id === active) ?? SECTIONS[0];
  if (section === undefined) return null;
  const Content = section.content;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={intl.formatMessage({ id: "settings.title" })}
      className="flex h-[min(85dvh,560px)] w-[min(94vw,760px)] flex-col"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label={intl.formatMessage({ id: "settings.close" })}
        className="absolute top-4 right-4"
        onClick={onClose}
      >
        <Icon icon={Cancel01Icon} />
      </Button>
      <div className="flex h-full min-h-0 flex-col gap-4 sm:flex-row sm:gap-6">
        <nav
          aria-label={intl.formatMessage({ id: "settings.sections" })}
          className="flex shrink-0 gap-1 overflow-x-auto sm:min-w-40 sm:flex-col"
        >
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.id === active ? "page" : undefined}
              onClick={() => setActive(item.id)}
              className={cn(
                "pressable flex h-9 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-md px-3 text-left text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                item.id === active && "bg-muted font-medium text-foreground",
              )}
            >
              <Icon icon={item.icon} size={15} />
              {intl.formatMessage({ id: item.label })}
            </button>
          ))}
        </nav>
        <section
          aria-label={intl.formatMessage({ id: section.label })}
          className="min-h-0 min-w-0 flex-1 overflow-auto pr-1"
        >
          <h3 className="font-semibold text-base tracking-tight">
            {intl.formatMessage({ id: section.label })}
          </h3>
          <Content />
        </section>
      </div>
    </Dialog>
  );
}
