import type { SourceKind } from '@/data/cases/types';
import type { IconName } from '@/components/ui/Icon';

/** Maps a source-document kind to its icon + i18n label key + accent gradient. */
export const DOC_META: Record<SourceKind, { icon: IconName; labelKey: string; accent: string }> = {
  profileCard: { icon: 'profile', labelKey: 'case.doc.profileCard', accent: 'from-sky to-grape' },
  chatLog: { icon: 'chat', labelKey: 'case.doc.chatLog', accent: 'from-mint to-sky' },
  email: { icon: 'mail', labelKey: 'case.doc.email', accent: 'from-grape to-bubble' },
  note: { icon: 'file', labelKey: 'case.doc.note', accent: 'from-mango to-sun' },
  ticket: { icon: 'ticket', labelKey: 'case.doc.ticket', accent: 'from-bubble to-grape' },
};
