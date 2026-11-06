/**
 * デモ用の固定データ。
 * ここに無い文章には翻訳を生成しない（任意の文章を翻訳できるように見せない）。
 */
import type { ScenarioId } from './types';

export interface ClinicianSample {
  key: string;
  en: string;
  ja: string;
  answerType: 'free' | 'choice';
}

export const CLINICIAN_SAMPLES: ClinicianSample[] = [
  { key: 'q_today', en: 'What brings you in today?', ja: '今日はどうされましたか？', answerType: 'free' },
  { key: 'q_medicine', en: 'Have you taken any medicine for this?', ja: 'この症状に対して薬を使いましたか？', answerType: 'choice' },
  { key: 'q_where', en: 'Where does it hurt?', ja: 'どこが痛みますか？', answerType: 'free' },
];

export interface AmbiguityOption {
  key: string;
  ja: string;
  en: string;
  /** 相手に伝える内容に入る1行 */
  point: string;
  translation: string;
  unresolved?: boolean;
}

export interface Ambiguity {
  term: string;
  heading: string;
  options: AmbiguityOption[];
}

export interface FreeSample {
  key: string;
  text: string;
  points: string[];
  translation?: string;
  ambiguity?: Ambiguity;
}

const KURUSHII: Ambiguity = {
  term: '苦しい',
  heading: '『苦しい』は、どれに近いですか？',
  options: [
    {
      key: 'breath',
      ja: '息がしづらい',
      en: 'hard to breathe',
      point: '息がしづらい',
      translation: 'I have been experiencing shortness of breath occasionally since yesterday.',
    },
    {
      key: 'pressure',
      ja: '圧迫される感じ',
      en: 'a feeling of pressure',
      point: '胸が圧迫される感じがある',
      translation: 'I have occasionally felt a sense of pressure in my chest since yesterday.',
    },
    {
      key: 'pain',
      ja: '痛み',
      en: 'pain',
      point: '胸に痛みがある',
      translation: 'I have occasionally had chest pain since yesterday.',
    },
    {
      key: 'unsure',
      ja: 'うまく説明できない',
      en: 'could not describe it',
      point: '胸が「苦しい」感じがある（どんな感じかは、うまく説明できない）',
      translation:
        'Since yesterday, I have occasionally had a feeling in my chest that I describe as “kurushii” (苦しい). I could not describe more specifically what it feels like.',
      unresolved: true,
    },
  ],
};

export interface FreeAnswerSet {
  /** 「音声入力を試す」で入る文章 */
  voice: string;
  /** デモ用サンプルとして提示する文章 */
  suggestions: string[];
  samples: FreeSample[];
}

export const FREE_ANSWERS: Record<string, FreeAnswerSet> = {
  q_today: {
    voice: '昨日から、たまに胸が苦しい',
    suggestions: ['昨日から、たまに胸が苦しい', '昨日から、たまに胸が痛い'],
    samples: [
      {
        key: 'a_today_kurushii',
        text: '昨日から、たまに胸が苦しい',
        points: ['昨日から始まった', 'ときどき起きる'],
        ambiguity: KURUSHII,
      },
      {
        key: 'a_today_itai',
        text: '昨日から、たまに胸が痛い',
        points: ['昨日から始まった', 'ときどき起きる', '胸が痛い'],
        translation: 'I have occasionally had chest pain since yesterday.',
      },
    ],
  },
  q_where: {
    voice: '右側です',
    suggestions: ['右側です', '左側です', '真ん中です'],
    samples: [
      { key: 'a_where_right', text: '右側です', points: ['右側が痛い'], translation: 'It hurts on the right side.' },
      { key: 'a_where_left', text: '左側です', points: ['左側が痛い'], translation: 'It hurts on the left side.' },
      { key: 'a_where_middle', text: '真ん中です', points: ['真ん中が痛い'], translation: 'It hurts in the middle.' },
    ],
  },
};

export interface ChoiceOption {
  key: string;
  ja: string;
  point: string;
  translation: string;
}

export const CHOICE_ANSWERS: Record<string, ChoiceOption[]> = {
  q_medicine: [
    { key: 'yes', ja: 'はい', point: 'この症状に対して薬を使った', translation: 'Yes, I have taken medicine for this.' },
    { key: 'no', ja: 'いいえ', point: 'この症状に対して薬は使っていない', translation: 'No, I have not taken any medicine for this.' },
    {
      key: 'unknown',
      ja: '覚えていない',
      point: '薬を使ったかどうか、覚えていない',
      translation: 'I don’t remember whether I have taken any medicine for this.',
    },
  ],
};

export interface AskSample {
  key: string;
  ja: string;
  en: string;
}

export const PATIENT_ASK_SAMPLES: AskSample[] = [
  { key: 'p_again', ja: 'もう一度説明してください', en: 'Could you explain that again?' },
  { key: 'p_dontknow', ja: '質問が分かりません', en: 'I don’t understand the question.' },
  { key: 'p_slowly', ja: 'ゆっくり話してください', en: 'Could you speak more slowly?' },
];

export interface ScenarioDef {
  id: ScenarioId;
  label: string;
  steps: string[];
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 's1',
    label: 'シナリオ1：曖昧な表現を確認する',
    steps: [
      '医療者画面：質問の内容を確認して「Send」',
      '患者画面：「音声入力を試す」→ 必要なら文章を編集 →「次へ」',
      '「苦しい」の意味を選ぶ（例：息がしづらい／うまく説明できない）',
      '送信内容を確認して「この内容で送信」',
      '医療者画面で翻訳（Demo translation）と元の発言を確認',
    ],
  },
  {
    id: 's2',
    label: 'シナリオ2：明確な回答はすぐ送れる',
    steps: [
      '医療者画面：「Send」で薬の質問を送る',
      '患者画面：「覚えていない」を選ぶ（未選択では送信できない）',
      'その場で「この内容で送信」',
      '医療者画面で “I don’t remember…” を確認',
    ],
  },
  {
    id: 's3',
    label: 'シナリオ3：送信後に訂正する',
    steps: [
      '患者画面：送信済みの「右側です」で「訂正する」',
      '「左側です」に変更 →「次へ」（この時点では相手に送られない）',
      '「訂正を送信」',
      '医療者画面：Corrected 表示と「Previous answer」を確認 →「Mark correction as seen」',
      '患者画面で「相手が訂正を確認しました」を確認',
    ],
  },
  {
    id: 's4',
    label: 'シナリオ4：患者から質問する',
    steps: [
      '患者画面：「自分から質問する」',
      '「もう一度説明してください」を選び、内容を確認して送信',
      '医療者画面で “Could you explain that again?” を確認',
      '医療者画面：「Ask a question」から質問を送り直す',
    ],
  },
];

export const ERROR_TIP = '通信エラーをONにして送信 → 送信失敗（相手には届かない）→ OFFにして「再送信」';
