import { useMemo } from "react";
import { useIntl } from "react-intl";
import { formatBytes, formatRelative } from "../lib/format";

/** Number, size and date formatting in the interface language. */
export function useFormat() {
  const intl = useIntl();
  return useMemo(
    () => ({
      number: (value: number) => intl.formatNumber(value),
      percent: (ratio: number) =>
        intl.formatNumber(ratio, { style: "percent", maximumFractionDigits: 0 }),
      bytes: (value: number) => formatBytes(value, intl.locale),
      relative: (iso: string) => formatRelative(iso, intl.locale),
      time: (date: Date) => intl.formatTime(date, { hour: "2-digit", minute: "2-digit" }),
    }),
    [intl],
  );
}
