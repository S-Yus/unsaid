/**
 * 下書きから「相手に伝える内容」を組み立てる純粋関数。
 * 送信のたびに現在の入力から再計算するので、入力を変えた後に
 * 変更前の固定翻訳が送られることはない。
 */
import {
  CHOICE_ANSWERS,
  CLINICIAN_SAMPLES,
  FREE_ANSWERS,
  PATIENT_ASK_SAMPLES,
  type Ambiguity,
} from './data';
import type { Content, Draft, DraftInputs } from './types';

export type Composed =
  | { status: 'empty' }
  | { status: 'unsupported' }
  | { status: 'unsupportedClar' }
  | { status: 'needsChoice' }
  | { status: 'needsClarification'; ambiguity: Ambiguity }
  | { status: 'ready'; content: Content };

/** 句読点・空白・全角半角の違いだけは同じ文章とみなす */
export function normalize(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[\s\p{P}]/gu, '');
}

const same = (a: string, b: string) => normalize(a) === normalize(b);

function snapshot(d: DraftInputs): DraftInputs {
  return { text: d.text, choice: d.choice, custom: d.custom, clarChoice: d.clarChoice, clarCustom: d.clarCustom };
}

export function composeClinician(d: DraftInputs): Composed {
  if (!d.text.trim()) return { status: 'empty' };
  const s = CLINICIAN_SAMPLES.find((x) => same(x.en, d.text));
  if (!s) return { status: 'unsupported' };
  return {
    status: 'ready',
    content: { original: d.text.trim(), translation: s.ja, sampleKey: s.key, inputs: snapshot(d) },
  };
}

export function composeAsk(d: DraftInputs): Composed {
  if (!d.text.trim()) return { status: 'empty' };
  const s = PATIENT_ASK_SAMPLES.find((x) => same(x.ja, d.text));
  if (!s) return { status: 'unsupported' };
  return {
    status: 'ready',
    content: { original: d.text.trim(), points: [s.ja], translation: s.en, sampleKey: s.key, inputs: snapshot(d) },
  };
}

export function ambiguityFor(questionKey: string, text: string): Ambiguity | undefined {
  return FREE_ANSWERS[questionKey]?.samples.find((x) => same(x.text, text))?.ambiguity;
}

export function composeFree(questionKey: string, d: DraftInputs): Composed {
  if (!d.text.trim()) return { status: 'empty' };
  const set = FREE_ANSWERS[questionKey];
  const s = set?.samples.find((x) => same(x.text, d.text));
  if (!s) return { status: 'unsupported' };
  const base = { original: d.text.trim(), sampleKey: s.key, inputs: snapshot(d) };
  if (!s.ambiguity) {
    return { status: 'ready', content: { ...base, points: s.points, translation: s.translation ?? '' } };
  }
  const amb = s.ambiguity;
  if (!d.clarChoice) return { status: 'needsClarification', ambiguity: amb };
  let opt = amb.options.find((o) => o.key === d.clarChoice);
  if (d.clarChoice === 'custom') {
    if (!d.clarCustom.trim()) return { status: 'needsClarification', ambiguity: amb };
    opt = amb.options.find((o) => same(o.ja, d.clarCustom) || same(o.point, d.clarCustom));
    if (!opt) return { status: 'unsupportedClar' };
  }
  if (!opt) return { status: 'needsClarification', ambiguity: amb };
  return {
    status: 'ready',
    content: {
      ...base,
      sampleKey: `${s.key}:${opt.key}`,
      points: [...s.points, opt.point],
      translation: opt.translation,
      clarification: {
        term: amb.term,
        choiceKey: opt.key,
        choiceJa: opt.ja,
        choiceEn: opt.en,
        unresolved: !!opt.unresolved,
      },
    },
  };
}

export function composeChoice(questionKey: string, d: DraftInputs): Composed {
  const options = CHOICE_ANSWERS[questionKey] ?? [];
  if (!d.choice) return { status: 'needsChoice' };
  let opt = options.find((o) => o.key === d.choice);
  let original = opt?.ja ?? '';
  if (d.choice === 'custom') {
    if (!d.custom.trim()) return { status: 'empty' };
    opt = options.find((o) => same(o.ja, d.custom) || same(o.point, d.custom));
    original = d.custom.trim();
    if (!opt) return { status: 'unsupported' };
  }
  if (!opt) return { status: 'needsChoice' };
  return {
    status: 'ready',
    content: {
      original,
      points: [opt.point],
      translation: opt.translation,
      sampleKey: `${questionKey}:${opt.key}`,
      inputs: snapshot(d),
    },
  };
}

export function composeDraft(d: Draft): Composed {
  switch (d.mode) {
    case 'clinician':
      return composeClinician(d);
    case 'ask':
      return composeAsk(d);
    case 'answer-free':
      return composeFree(d.questionKey ?? '', d);
    case 'answer-choice':
      return composeChoice(d.questionKey ?? '', d);
  }
}

/** 訂正で内容が変わっていない場合は送信させない */
export function sameContent(a: Content, b: Content): boolean {
  return a.translation === b.translation && (a.points ?? []).join('\n') === (b.points ?? []).join('\n');
}

export const emptyInputs = (): DraftInputs => ({ text: '', custom: '', clarCustom: '' });
