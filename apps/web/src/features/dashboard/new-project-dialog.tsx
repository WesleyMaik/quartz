import { PROJECT_TEMPLATES, type Project, type ProjectTemplate } from "@qrtz/document-core";
import type { MessageId } from "@qrtz/messages";
import { Button, cn, Dialog, Input } from "@qrtz/ui";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { useServices } from "../../app/services";
import { useDescribeError } from "../../app/use-describe-error";

const TEMPLATE_LABELS: Readonly<Record<string, MessageId>> = {
  "typst-article": "template.typst-article",
  "latex-article": "template.latex-article",
  "typst-empty": "template.typst-empty",
  "latex-empty": "template.latex-empty",
};

export function NewProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: (project: Project) => void;
}) {
  const { projects } = useServices();
  const [templateId, setTemplateId] = useState(PROJECT_TEMPLATES[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const intl = useIntl();
  const describeError = useDescribeError();

  const templateLabel = (template: ProjectTemplate): string => {
    const id = TEMPLATE_LABELS[template.id];
    return id === undefined ? template.label : intl.formatMessage({ id });
  };

  const submit = async () => {
    setBusy(true);
    const template = PROJECT_TEMPLATES.find((item) => item.id === templateId);
    // An empty title takes the template's name, in the interface language.
    const fallback = template === undefined ? "" : templateLabel(template);
    const result = await projects.createFromTemplate(templateId, title.trim() || fallback);
    setBusy(false);
    if (!result.ok) {
      setError(describeError(result.error));
      return;
    }
    setTitle("");
    setError(undefined);
    onOpenChange(false);
    onCreated(result.value);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={intl.formatMessage({ id: "dashboard.new_project" })}
      description={intl.formatMessage({ id: "new_project.description" })}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {intl.formatMessage({ id: "common.cancel" })}
          </Button>
          <Button onClick={submit} disabled={busy}>
            {intl.formatMessage({ id: "new_project.create" })}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-2 font-medium">
            {intl.formatMessage({ id: "new_project.template" })}
          </legend>
          {PROJECT_TEMPLATES.map((template) => (
            <label
              key={template.id}
              className={cn(
                "pressable flex cursor-pointer flex-col rounded-lg border px-3 py-2.5 hover:border-primary/40 hover:bg-muted/50 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/30",
                template.id === templateId &&
                  "border-primary bg-accent text-accent-foreground ring-3 ring-primary/15 hover:border-primary hover:bg-accent",
              )}
            >
              <input
                type="radio"
                name="template"
                value={template.id}
                checked={template.id === templateId}
                onChange={() => setTemplateId(template.id)}
                className="sr-only"
              />
              <span className="font-medium">{templateLabel(template)}</span>
              <span className="text-muted-foreground text-xs">{template.entry}</span>
            </label>
          ))}
        </fieldset>
        <div className="space-y-1.5">
          <label htmlFor={titleId} className="block font-medium">
            {intl.formatMessage({ id: "dashboard.title_label" })}
          </label>
          <Input
            id={titleId}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={intl.formatMessage({ id: "new_project.placeholder" })}
            autoFocus
          />
        </div>
        {error === undefined ? null : <p className="text-destructive">{error}</p>}
      </form>
    </Dialog>
  );
}
