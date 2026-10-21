import type { SourceKind } from '@/data/cases/types';
import type { IconName } from '@/components/ui/Icon';

/** Maps a source-document kind to its icon + i18n label key + header tone. */
export const DOC_META: Record<SourceKind, { icon: IconName; labelKey: string; accent: string }> = {
  profileCard: { icon: 'profile', labelKey: 'case.doc.profileCard', accent: 'bg-info-50 text-info-700' },
  chatLog: { icon: 'chat', labelKey: 'case.doc.chatLog', accent: 'bg-success-50 text-success-700' },
  email: { icon: 'mail', labelKey: 'case.doc.email', accent: 'bg-brand-50 text-brand-700' },
  note: { icon: 'file', labelKey: 'case.doc.note', accent: 'bg-amber-50 text-amber-700' },
  ticket: { icon: 'ticket', labelKey: 'case.doc.ticket', accent: 'bg-violet-50 text-violet-700' },
};
