import { Button, DropdownMenu, Icon, Switch } from "@qrtz/ui";
import { ArrowDown01Icon } from "@qrtz/ui/icons";
import { type ReactNode, useId } from "react";

/** One preference: what it does on the left, its control on the right. */
export function SettingsRow({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  readonly title: string;
  readonly description: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <SettingsRow title={title} description={description}>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-label={title} />
    </SettingsRow>
  );
}

export function SelectRow<Value extends string>({
  title,
  description,
  value,
  options,
  onChange,
}: {
  readonly title: string;
  readonly description: string;
  readonly value: Value;
  readonly options: readonly { readonly id: Value; readonly label: string }[];
  readonly onChange: (value: Value) => void;
}) {
  const current = options.find((option) => option.id === value)?.label ?? value;
  return (
    <SettingsRow title={title} description={description}>
      <DropdownMenu
        trigger={
          <Button variant="outline" size="sm" aria-label={`${title}: ${current}`}>
            {current}
            <Icon icon={ArrowDown01Icon} size={14} />
          </Button>
        }
        actions={options.map((option) => ({
          id: option.id,
          label: option.label,
          selected: option.id === value,
          onSelect: () => onChange(option.id),
        }))}
      />
    </SettingsRow>
  );
}
