import type { QuartzError } from "@qrtz/document-core";
import { englishMessages, type MessageId } from "@qrtz/messages";
import type { IntlShape } from "react-intl";

const isMessageId = (id: string): id is MessageId => Object.hasOwn(englishMessages, id);

/**
 * The sentence for a domain error. The template type of `error.${key}` makes a key without a
 * catalog entry a compile error.
 */
export function describeError(intl: IntlShape, { key, values }: QuartzError): string {
  // An unsafe archive path names its rule, which is a sentence of its own.
  const rule = `error.path.${values?.pathReason}`;
  const nested = isMessageId(rule) ? { problem: intl.formatMessage({ id: rule }) } : {};
  return intl.formatMessage({ id: `error.${key}` }, { ...values, ...nested });
}
