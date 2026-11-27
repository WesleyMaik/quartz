import type { OutlineNode } from "@qrtz/document-core";
import { cn, Icon } from "@qrtz/ui";
import { ArrowRight01Icon } from "@qrtz/ui/icons";
import { useState } from "react";
import { useCollapsed } from "../../app/use-collapsed";

const chevron = (open: boolean) =>
  cn("shrink-0 transition-transform duration-200 ease-out", open && "rotate-90");

/** Collapsible table of contents; selecting a heading jumps to it in the editor. */
export function OutlinePanel({
  nodes,
  onSelect,
}: {
  readonly nodes: readonly OutlineNode[];
  readonly onSelect: (node: OutlineNode) => void;
}) {
  const panel = useCollapsed("quartz:outline");
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());

  const toggle = (key: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const renderNodes = (items: readonly OutlineNode[], depth: number, parentKey: string) =>
    items.map((node, index) => {
      // Titles rather than line numbers, so branches stay closed while the text above changes.
      const key = `${parentKey}/${index}:${node.title}`;
      const open = !closed.has(key);
      return (
        <li key={key}>
          <div
            className="flex items-center rounded-md pr-1 text-muted-foreground transition-colors duration-150 focus-within:text-foreground hover:bg-muted/70 hover:text-foreground"
            style={{ paddingLeft: 8 + depth * 14 }}
          >
            <button
              type="button"
              className="h-7 min-w-0 cursor-pointer truncate rounded-md text-left"
              title={`${node.title} (${node.file}:${node.line})`}
              onClick={() => onSelect(node)}
            >
              {node.title}
            </button>
            {node.children.length === 0 ? null : (
              <button
                type="button"
                className="pressable ml-1 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-foreground/10"
                aria-expanded={open}
                aria-label={`${open ? "Collapse" : "Expand"} ${node.title}`}
                onClick={() => toggle(key)}
              >
                <Icon icon={ArrowRight01Icon} size={12} className={chevron(open)} />
              </button>
            )}
          </div>
          {open && node.children.length > 0 ? (
            <ul>{renderNodes(node.children, depth + 1, key)}</ul>
          ) : null}
        </li>
      );
    });

  return (
    <nav
      aria-label="Document outline"
      className={cn("flex shrink-0 flex-col border-t", !panel.collapsed && "max-h-[50%]")}
    >
      <button
        type="button"
        className="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 px-2 text-left font-semibold text-sm tracking-tight"
        aria-expanded={!panel.collapsed}
        onClick={panel.toggle}
      >
        <Icon icon={ArrowRight01Icon} size={14} className={chevron(!panel.collapsed)} />
        Outline
      </button>
      {panel.collapsed ? null : nodes.length === 0 ? (
        <p className="px-4 pb-3 text-muted-foreground text-xs">
          Headings of your document appear here.
        </p>
      ) : (
        <ul className="min-h-0 overflow-auto px-2 pb-2">{renderNodes(nodes, 0, "")}</ul>
      )}
    </nav>
  );
}
