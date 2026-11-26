import type { CompilerDiagnostic } from "@qrtz/compiler-core";
import type { ProjectId, ProjectPath } from "@qrtz/document-core";
import {
  createEditorState,
  type EditorState,
  EditorView,
  languageForPath,
  revealLine,
  showDiagnostics,
} from "@qrtz/editor";
import { toast } from "@qrtz/ui";
import { type Ref, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useServices } from "../../app/services";
import { formatBytes } from "../../lib/format";

const AUTOSAVE_DELAY_MS = 750;

interface Session {
  state: EditorState;
  savedText: string;
  timer: ReturnType<typeof setTimeout> | undefined;
  saving: Promise<void> | undefined;
}

export interface EditorPaneHandle {
  /** Writes every dirty buffer to storage. */
  flush(): Promise<void>;
  reveal(line: number): void;
  /** Drops cached buffers for paths that no longer exist. */
  forget(path: string): void;
}

type BinaryView = {
  readonly url: string | undefined;
  readonly size: number;
  readonly mediaType: string;
};

export function EditorPane({
  projectId,
  path,
  diagnostics,
  onSaved,
  onDirtyChange,
  onCompileShortcut,
  ref,
}: {
  readonly projectId: ProjectId;
  readonly path: ProjectPath | undefined;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly onSaved: () => void;
  readonly onDirtyChange: (path: string, dirty: boolean) => void;
  readonly onCompileShortcut: () => void;
  readonly ref?: Ref<EditorPaneHandle>;
}) {
  const { files } = useServices();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | undefined>(undefined);
  const sessions = useRef(new Map<string, Session>());
  const activePath = useRef<string | undefined>(undefined);
  const [binary, setBinary] = useState<BinaryView | undefined>();
  const callbacks = useRef({ onSaved, onDirtyChange, onCompileShortcut });
  callbacks.current = { onSaved, onDirtyChange, onCompileShortcut };

  const currentText = (filePath: string, session: Session): string =>
    activePath.current === filePath && viewRef.current !== undefined
      ? viewRef.current.state.doc.toString()
      : session.state.doc.toString();

  const save = useCallback(
    async (filePath: string): Promise<void> => {
      const session = sessions.current.get(filePath);
      if (session === undefined) return;
      clearTimeout(session.timer);
      session.timer = undefined;
      await session.saving;
      const text = currentText(filePath, session);
      if (text === session.savedText) return;
      session.saving = (async () => {
        const result = await files.saveText(projectId, filePath as ProjectPath, text);
        if (!result.ok) {
          toast.error(`Not saved: ${result.error.message}`);
          return;
        }
        session.savedText = text;
        const dirty = currentText(filePath, session) !== text;
        callbacks.current.onDirtyChange(filePath, dirty);
        callbacks.current.onSaved();
      })();
      await session.saving;
      session.saving = undefined;
    },
    [files, projectId],
  );

  const flush = useCallback(async () => {
    await Promise.all([...sessions.current.keys()].map((filePath) => save(filePath)));
  }, [save]);

  useImperativeHandle(
    ref,
    () => ({
      flush,
      reveal: (line) => {
        if (viewRef.current !== undefined) revealLine(viewRef.current, line);
      },
      forget: (filePath) => {
        const session = sessions.current.get(filePath);
        if (session !== undefined) clearTimeout(session.timer);
        sessions.current.delete(filePath);
      },
    }),
    [flush],
  );

  // One EditorView for the pane; each file keeps its own EditorState (undo history, selection).
  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    const view = new EditorView({ parent: host });
    viewRef.current = view;
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onPageHide = () => void flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      void flush();
      view.destroy();
      viewRef.current = undefined;
    };
  }, [flush]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === undefined) return;
    let cancelled = false;
    let objectUrl: string | undefined;
    activePath.current = path;
    setBinary(undefined);
    if (path === undefined) {
      view.setState(
        createEditorState({ doc: "", language: "plain", onDocChange: () => undefined }),
      );
      return;
    }

    const open = async () => {
      let session = sessions.current.get(path);
      if (session === undefined) {
        const read = await files.read(projectId, path);
        if (cancelled) return;
        if (read === undefined) return;
        if (read.content.kind === "binary") {
          const bytes = read.content.bytes;
          const isImage =
            /^image\/(png|jpeg|gif|webp)$/.test(bytes.type) ||
            /\.(png|jpe?g|gif|webp)$/i.test(path);
          objectUrl = isImage ? URL.createObjectURL(bytes) : undefined;
          setBinary({ url: objectUrl, size: bytes.size, mediaType: bytes.type || "binary" });
          return;
        }
        const text = read.content.text;
        const created: Session = {
          savedText: text,
          timer: undefined,
          saving: undefined,
          state: createEditorState({
            doc: text,
            language: languageForPath(path),
            extraKeys: [
              {
                key: "Mod-s",
                preventDefault: true,
                run: () => {
                  void save(path).then(() => callbacks.current.onCompileShortcut());
                  return true;
                },
              },
              {
                key: "Mod-Enter",
                preventDefault: true,
                run: () => {
                  void save(path).then(() => callbacks.current.onCompileShortcut());
                  return true;
                },
              },
            ],
            onDocChange: (doc) => {
              const current = sessions.current.get(path);
              if (current === undefined) return;
              callbacks.current.onDirtyChange(path, doc !== current.savedText);
              clearTimeout(current.timer);
              current.timer = setTimeout(() => void save(path), AUTOSAVE_DELAY_MS);
            },
          }),
        };
        sessions.current.set(path, created);
        session = created;
      }
      view.setState(session.state);
      view.focus();
    };
    void open();

    return () => {
      cancelled = true;
      if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl);
      const session = sessions.current.get(path);
      if (session !== undefined && activePath.current === path) session.state = view.state;
    };
  }, [path, files, projectId, save]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === undefined || path === undefined || binary !== undefined) return;
    showDiagnostics(
      view,
      diagnostics.flatMap((d) =>
        d.file === path && d.line !== undefined
          ? [
              {
                severity: d.severity,
                message: d.message,
                line: d.line,
                ...(d.column === undefined ? {} : { column: d.column }),
              },
            ]
          : [],
      ),
    );
  }, [diagnostics, path, binary]);

  return (
    <div className="relative h-full">
      <div ref={hostRef} className="h-full" data-testid="editor" />
      {binary === undefined ? null : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-6 text-muted-foreground">
          {binary.url === undefined ? null : (
            <img
              src={binary.url}
              alt={path ?? ""}
              className="max-h-[70%] max-w-full rounded border"
            />
          )}
          <span>
            {binary.mediaType} · {formatBytes(binary.size)}
          </span>
        </div>
      )}
      {path === undefined ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background text-muted-foreground">
          Select a file to edit
        </div>
      ) : null}
    </div>
  );
}
