import { Button, cn, Icon } from "@qrtz/ui";
import { LayoutAlignLeftIcon } from "@qrtz/ui/icons";
import { useIntl } from "react-intl";

/** Collapse/pin button; the icon mirrors to point where the sidebar will go. */
export function SidebarToggle({
  collapsed,
  onToggle,
  className,
}: {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  readonly className?: string;
}) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: collapsed ? "sidebar.show" : "sidebar.hide" });
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-expanded={!collapsed}
      title={intl.formatMessage({ id: "sidebar.shortcut" }, { label })}
      onClick={onToggle}
      className={cn("group/toggle", className)}
    >
      <Icon
        icon={LayoutAlignLeftIcon}
        size={16}
        className={cn(
          "transition-[scale] duration-300 ease-out group-hover/toggle:scale-110",
          collapsed &&
            "-scale-x-100 group-hover/toggle:-scale-x-110 group-hover/toggle:scale-y-110",
        )}
      />
    </Button>
  );
}
