import { useEffect } from "react";

/** Sets `document.title` while the caller is mounted and restores the previous title afterwards. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
