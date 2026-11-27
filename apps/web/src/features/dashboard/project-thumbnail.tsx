import { Icon } from "@qrtz/ui";
import { File01Icon } from "@qrtz/ui/icons";
import { useEffect, useState } from "react";

const useObjectUrl = (blob: Blob | undefined): string | undefined => {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    if (blob === undefined) {
      setUrl(undefined);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
};

/** First page of the project as a sheet of paper; an icon until the project has been compiled. */
export function CardThumbnail({ image }: { readonly image: Blob | undefined }) {
  const url = useObjectUrl(image);
  return (
    <span className="flex aspect-[4/3] flex-col items-center justify-center-safe overflow-hidden bg-muted/60 text-muted-foreground transition-colors duration-200 group-hover:text-primary">
      {url === undefined ? (
        <span className="flex h-20 w-16 items-center justify-center rounded-sm bg-card shadow-sm transition-transform duration-300 ease-out group-hover:-translate-y-1">
          <Icon icon={File01Icon} size={22} />
        </span>
      ) : (
        <img
          src={url}
          alt=""
          className="mt-4 w-[68%] shrink-0 rounded-t-sm bg-white shadow-sm transition-transform duration-300 ease-out group-hover:-translate-y-1"
        />
      )}
    </span>
  );
}

export function RowThumbnail({ image }: { readonly image: Blob | undefined }) {
  const url = useObjectUrl(image);
  return (
    <span className="flex h-11 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background text-muted-foreground transition-[color,border-color] duration-150 group-hover:border-primary/30 group-hover:text-primary">
      {url === undefined ? (
        <Icon icon={File01Icon} size={16} />
      ) : (
        <img src={url} alt="" className="size-full bg-white object-cover object-top" />
      )}
    </span>
  );
}
