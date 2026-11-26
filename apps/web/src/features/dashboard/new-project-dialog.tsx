import { PROJECT_TEMPLATES, type Project } from "@qrtz/document-core";
import { Button, cn, Dialog, Input } from "@qrtz/ui";
import { useId, useState } from "react";
import { useServices } from "../../app/services";

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

  const submit = async () => {
    setBusy(true);
    const result = await projects.createFromTemplate(templateId, title);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
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
      title="New project"
      description="Choose a starting point. You can add files and folders later."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            Create
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
          <legend className="mb-2 font-medium">Template</legend>
          {PROJECT_TEMPLATES.map((template) => (
            <label
              key={template.id}
              className={cn(
                "flex cursor-pointer flex-col rounded-md border px-3 py-2 hover:bg-panel",
                template.id === templateId && "border-primary bg-accent text-accent-foreground",
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
              <span className="font-medium">{template.label}</span>
              <span className="text-muted-foreground text-xs">{template.entry}</span>
            </label>
          ))}
        </fieldset>
        <div className="space-y-1.5">
          <label htmlFor={titleId} className="block font-medium">
            Title
          </label>
          <Input
            id={titleId}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Untitled paper"
            autoFocus
          />
        </div>
        {error === undefined ? null : <p className="text-destructive">{error}</p>}
      </form>
    </Dialog>
  );
}
