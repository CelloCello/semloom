import { english } from './locales/en.js';
import { traditionalChinese } from './locales/zh-TW.js';
import type { ReportMessages } from './locales/types.js';

export function reportMessages(locale?: string): ReportMessages {
  return locale?.toLowerCase().split('-')[0] === 'en'
    ? english
    : traditionalChinese;
}

// Plugin-owned labels remain authored text; only built-in IDs use this catalog.
export function reportVariant(
  id: string,
  locale = 'zh-TW',
  fallback = id,
): { label: string; locale: string } {
  const messages = reportMessages(locale);
  switch (id) {
    case 'comparison.cards':
      return { label: messages.cards, locale: messages.locale };
    case 'comparison.table':
      return { label: messages.table, locale: messages.locale };
    case 'comparison.responsive':
      return { label: messages.responsive, locale: messages.locale };
    default:
      return { label: fallback, locale };
  }
}
