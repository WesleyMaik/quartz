import type { QuartzError } from "@qrtz/document-core";
import { useCallback } from "react";
import { useIntl } from "react-intl";
import { describeError } from "../lib/describe-error";

/** Translates domain errors into the interface language. */
export function useDescribeError(): (error: QuartzError) => string {
  const intl = useIntl();
  return useCallback((error: QuartzError) => describeError(intl, error), [intl]);
}
