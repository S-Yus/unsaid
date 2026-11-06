export type Role = 'patient' | 'clinician';

/** どの入力UIで作られた下書きか */
export type DraftMode = 'answer-free' | 'answer-choice' | 'ask' | 'clinician';

/**
 * 下書きの段階。
 * input=下書き / clarify・confirm=確認中 / sending=送信中 / failed=送信失敗
 * （受信済み・訂正済みは Message 側の状態）
 */
export type Phase = 'input' | 'clarify' | 'confirm' | 'sending' | 'failed';

export interface DraftInputs {
  text: string;
  /** 選択式の回答（はい/いいえ/覚えていない/custom） */
  choice?: string;
  /** 選択式で「自分で書く」を選んだときの文章 */
  custom: string;
  /** 意味の確認で選んだもの */
  clarChoice?: string;
  /** 意味の確認で「自分で書く」を選んだときの文章 */
  clarCustom: string;
}

export interface Draft extends DraftInputs {
  /** 送信後のメッセージID（訂正の場合は訂正ID）。下書き作成時点で確定させ、重複送信を防ぐ */
  id: string;
  role: Role;
  mode: DraftMode;
  /** 回答対象の質問のサンプルキー */
  questionKey?: string;
  /** 対応する質問のメッセージID */
  replyTo?: string;
  /** 訂正対象のメッセージID */
  correctionOf?: string;
  /** 「サンプルに戻す」で戻す文章 */
  sampleText?: string;
  phase: Phase;
  /** 送信処理の識別子。古い送信結果や連打を無視するために使う */
  token?: string;
}

export interface Clarification {
  term: string;
  choiceKey: string;
  choiceJa: string;
  choiceEn: string;
  /** 「うまく説明できない」など、意味が確定していない */
  unresolved: boolean;
}

/** 送信される内容（1つのバージョン） */
export interface Content {
  /** 本人の元の発言（入力したそのままの文章） */
  original: string;
  /** 本人が確認した「相手に伝える内容」（本人の言語） */
  points?: string[];
  clarification?: Clarification;
  /** 相手の言語での表示（デモ用の固定翻訳） */
  translation: string;
  sampleKey: string;
  /** 訂正時に入力欄を復元するための値 */
  inputs: DraftInputs;
}

export interface Message {
  id: string;
  from: Role;
  kind: 'question' | 'answer';
  /** 回答・関連する質問のメッセージID */
  replyTo?: string;
  mode: DraftMode;
  /** 医療者の質問なら自分のキー、回答なら対象の質問のキー */
  questionKey?: string;
  current: Content;
  /** 以前のバージョン（古い順） */
  previous: Content[];
  /** 訂正の状態：届いた（存在する）／相手が確認した（seen） */
  correction?: { id: string; seen: boolean };
}

export type ScenarioId = 's1' | 's2' | 's3' | 's4';

/** slot は 'extra'（自分からの質問・訂正）または回答対象の質問ID */
export interface DraftRef {
  role: Role;
  slot: string;
}

export interface AppState {
  scenario: ScenarioId;
  networkError: boolean;
  /** 相手に届いたメッセージのみ。未送信の下書きはここに入らない */
  messages: Message[];
  extra: Record<Role, Draft | null>;
  /** 患者の回答下書き（質問IDごと） */
  answerDrafts: Record<string, Draft>;
  nextId: number;
  activeTab: Role;
  unread: Record<Role, boolean>;
}
