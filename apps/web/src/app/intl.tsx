import {
  DEFAULT_LOCALE,
  englishMessages,
  type Locale,
  loadMessages,
  type MessageId,
  type Messages,
  resolveLocale,
} from "@qrtz/messages";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { IntlProvider } from "react-intl";
import { useSettings } from "./settings";

declare global {
  namespace FormatjsIntl {
    interface Message {
      ids: MessageId;
    }
  }
}

interface Catalog {
  readonly locale: Locale;
  readonly messages: Messages;
}

const ENGLISH: Catalog = { locale: DEFAULT_LOCALE, messages: englishMessages };

const subscribeToLanguages = (onChange: () => void) => {
  window.addEventListener("languagechange", onChange);
  return () => window.removeEventListener("languagechange", onChange);
};

/**
 * Provides translations for the language chosen in Settings. Nothing renders until the first
 * catalog arrives, so English never flashes; later changes keep the current text while loading.
 */
export function LocaleProvider({ children }: { readonly children: ReactNode }) {
  const preference = useSettings((settings) => settings.language);
  const languages = useSyncExternalStore(subscribeToLanguages, () => navigator.languages);
  const locale = resolveLocale(preference, languages);
  const [catalog, setCatalog] = useState<Catalog | undefined>(
    locale === DEFAULT_LOCALE ? ENGLISH : undefined,
  );

  useEffect(() => {
    let cancelled = false;
    void loadMessages(locale).then(
      (messages) => {
        if (!cancelled) setCatalog({ locale, messages });
      },
      // A catalog chunk that fails to load (offline, new deploy) must not leave a blank page.
      () => {
        if (!cancelled) setCatalog(ENGLISH);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    // Also selects the right glyphs for Chinese and Japanese text.
    if (catalog !== undefined) document.documentElement.lang = catalog.locale;
  }, [catalog]);

  if (catalog === undefined) return null;
  return (
    <IntlProvider
      locale={catalog.locale}
      defaultLocale={DEFAULT_LOCALE}
      messages={catalog.messages}
    >
      {children}
    </IntlProvider>
  );
}
