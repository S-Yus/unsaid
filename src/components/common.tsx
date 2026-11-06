import type { ReactNode } from 'react';
import type { StatusKey } from '../state';

const LABELS: Record<'ja' | 'en', Record<StatusKey, string>> = {
  ja: {
    none: 'なし',
    draft: '下書き',
    confirming: '確認中',
    sending: '送信中',
    received: '受信済み',
    failed: '送信失敗',
    corrected: '訂正済み',
  },
  en: {
    none: 'None',
    draft: 'Draft',
    confirming: 'Reviewing',
    sending: 'Sending',
    received: 'Delivered',
    failed: 'Failed to send',
    corrected: 'Corrected',
  },
};

const ICONS: Record<StatusKey, string> = {
  none: '–',
  draft: '✎',
  confirming: '◎',
  sending: '…',
  received: '✓',
  failed: '!',
  corrected: '↺',
};

export function StatusPill({ status, lang }: { status: StatusKey; lang: 'ja' | 'en' }) {
  return (
    <span className={`status status--${status}`}>
      {status === 'sending' ? <Spinner /> : <span aria-hidden="true" className="status-icon">{ICONS[status]}</span>}
      {LABELS[lang][status]}
    </span>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

/** 固定サンプル翻訳であることの明記 */
export function DemoTag({ children }: { children: ReactNode }) {
  return <span className="demo-tag">{children}</span>;
}

export function Badge({ tone, children }: { tone: 'corrected' | 'warn' | 'info' | 'ok'; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Notice({ tone, children }: { tone: 'warn' | 'error' | 'info'; children: ReactNode }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/** デモ用サンプルを入れるボタン群。本番の操作と見分けられるよう点線＋「デモ」表記 */
export function DemoSamples({
  label = 'DEMO',
  items,
  onPick,
  disabled,
}: {
  label?: string;
  items: string[];
  onPick: (s: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="demo-samples">
      <span className="demo-samples-label">{label}</span>
      {items.map((s) => (
        <button key={s} type="button" className="demo-chip" onClick={() => onPick(s)} disabled={disabled}>
          {s}
        </button>
      ))}
    </div>
  );
}

export function PanelHeader({
  role,
  lang,
  statusLabel,
  status,
  statusLang,
}: {
  role: string;
  lang: string;
  statusLabel: string;
  status: StatusKey;
  statusLang: 'ja' | 'en';
}) {
  return (
    <header className="panel-header">
      <div className="panel-role">
        <span className="panel-role-name">{role}</span>
        <span className="panel-lang">{lang}</span>
      </div>
      <div className="panel-status">
        <span className="panel-status-label">{statusLabel}</span>
        <StatusPill status={status} lang={statusLang} />
      </div>
    </header>
  );
}
