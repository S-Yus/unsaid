import { CLINICIAN_SAMPLES, FREE_ANSWERS } from './data';
import { composeDraft, emptyInputs, sameContent, type Composed } from './compose';
import type { AppState, Draft, DraftInputs, DraftMode, DraftRef, Message, Role, ScenarioId } from './types';

export const SEND_DELAY_MS = 1100;

const fmtId = (prefix: string, n: number) => `${prefix}-${String(n).padStart(3, '0')}`;
export const other = (r: Role): Role => (r === 'patient' ? 'clinician' : 'patient');

// ---------- 参照用ヘルパー ----------

export function getDraft(s: AppState, ref: DraftRef): Draft | null {
  if (ref.slot === 'extra') return s.extra[ref.role];
  return s.answerDrafts[ref.slot] ?? null;
}

export function findMessage(s: AppState, id?: string): Message | undefined {
  return id ? s.messages.find((m) => m.id === id) : undefined;
}

/** 医療者の質問のうち、患者の回答がまだ無いもの（最新） */
export function currentQuestion(s: AppState): Message | undefined {
  for (let i = s.messages.length - 1; i >= 0; i--) {
    const m = s.messages[i];
    if (m.from === 'clinician' && m.kind === 'question') {
      return isAnswered(s, m.id) ? undefined : m;
    }
  }
  return undefined;
}

export function isAnswered(s: AppState, questionId: string): boolean {
  return s.messages.some((m) => m.from === 'patient' && m.kind === 'answer' && m.replyTo === questionId);
}

export function answerModeFor(questionKey?: string): DraftMode {
  const q = CLINICIAN_SAMPLES.find((x) => x.key === questionKey);
  return q?.answerType === 'choice' ? 'answer-choice' : 'answer-free';
}

/** 送信可能かどうか（訂正で内容が同じ場合も不可） */
export function sendable(s: AppState, d: Draft): Composed & { unchanged?: boolean } {
  const c = composeDraft(d);
  if (c.status === 'ready' && d.correctionOf) {
    const target = findMessage(s, d.correctionOf);
    if (target && sameContent(target.current, c.content)) return { ...c, unchanged: true };
  }
  return c;
}

// ---------- 初期状態（シナリオ） ----------

function msgFrom(id: string, draft: Omit<Draft, 'id' | 'phase'>): Message {
  const c = composeDraft({ ...draft, id, phase: 'input' });
  if (c.status !== 'ready') throw new Error(`invalid scenario sample: ${id}`);
  return {
    id,
    from: draft.role,
    kind: draft.mode === 'answer-free' || draft.mode === 'answer-choice' ? 'answer' : 'question',
    replyTo: draft.replyTo,
    mode: draft.mode,
    questionKey: draft.mode === 'clinician' ? c.content.sampleKey : draft.questionKey,
    current: c.content,
    previous: [],
  };
}

const clinQ = (id: string, key: string) =>
  msgFrom(id, {
    role: 'clinician',
    mode: 'clinician',
    ...emptyInputs(),
    text: CLINICIAN_SAMPLES.find((q) => q.key === key)!.en,
  });

const patientA = (id: string, replyTo: string, questionKey: string, inputs: Partial<DraftInputs>) =>
  msgFrom(id, {
    role: 'patient',
    mode: answerModeFor(questionKey),
    questionKey,
    replyTo,
    ...emptyInputs(),
    ...inputs,
  });

function clinicianDraft(id: string, key: string): Draft {
  const text = CLINICIAN_SAMPLES.find((q) => q.key === key)!.en;
  return { id, role: 'clinician', mode: 'clinician', ...emptyInputs(), text, sampleText: text, phase: 'input' };
}

export function initialState(scenario: ScenarioId): AppState {
  const base: AppState = {
    scenario,
    networkError: false,
    messages: [],
    extra: { patient: null, clinician: null },
    answerDrafts: {},
    nextId: 1,
    activeTab: 'patient',
    unread: { patient: false, clinician: false },
  };
  const kurushii = { text: FREE_ANSWERS.q_today.voice, clarChoice: 'breath' };
  switch (scenario) {
    case 's1':
      return { ...base, extra: { patient: null, clinician: clinicianDraft('M-001', 'q_today') }, nextId: 2, activeTab: 'clinician' };
    case 's2':
      return {
        ...base,
        messages: [clinQ('M-001', 'q_today'), patientA('M-002', 'M-001', 'q_today', kurushii)],
        extra: { patient: null, clinician: clinicianDraft('M-003', 'q_medicine') },
        nextId: 4,
        activeTab: 'clinician',
      };
    case 's3':
      return {
        ...base,
        messages: [clinQ('M-001', 'q_where'), patientA('M-002', 'M-001', 'q_where', { text: '右側です' })],
        nextId: 3,
      };
    case 's4':
      return {
        ...base,
        messages: [
          clinQ('M-001', 'q_today'),
          patientA('M-002', 'M-001', 'q_today', kurushii),
          clinQ('M-003', 'q_medicine'),
        ],
        nextId: 4,
      };
  }
}

// ---------- Reducer ----------

export type Action =
  | { type: 'RESET'; scenario?: ScenarioId }
  | { type: 'SET_ERROR'; on: boolean }
  | { type: 'SET_TAB'; tab: Role }
  | { type: 'UPDATE'; ref: DraftRef; patch: Partial<Draft> }
  | { type: 'OPEN_ASK'; role: Role; text?: string }
  | { type: 'OPEN_CORRECTION'; role: Role; messageId: string }
  | { type: 'CLOSE_EXTRA'; role: Role }
  | { type: 'SEND_START'; ref: DraftRef; token: string }
  | { type: 'SEND_COMPLETE'; ref: DraftRef; token: string }
  | { type: 'ACK_CORRECTION'; messageId: string };

function setDraft(s: AppState, ref: DraftRef, d: Draft | null): AppState {
  if (ref.slot === 'extra') return { ...s, extra: { ...s.extra, [ref.role]: d } };
  const answerDrafts = { ...s.answerDrafts };
  if (d) answerDrafts[ref.slot] = d;
  else delete answerDrafts[ref.slot];
  return { ...s, answerDrafts };
}

/** 回答の下書きは最初の操作時に作る（IDもこの時点で確定） */
function ensureDraft(s: AppState, ref: DraftRef): [AppState, Draft | null] {
  const existing = getDraft(s, ref);
  if (existing || ref.slot === 'extra') return [s, existing];
  const q = findMessage(s, ref.slot);
  if (!q) return [s, null];
  const d: Draft = {
    id: fmtId('M', s.nextId),
    role: 'patient',
    mode: answerModeFor(q.questionKey),
    questionKey: q.questionKey,
    replyTo: q.id,
    ...emptyInputs(),
    sampleText: FREE_ANSWERS[q.questionKey ?? '']?.voice,
    phase: 'input',
  };
  return [{ ...s, nextId: s.nextId + 1 }, d];
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'RESET':
      return initialState(a.scenario ?? s.scenario);

    case 'SET_ERROR':
      return { ...s, networkError: a.on };

    case 'SET_TAB':
      return { ...s, activeTab: a.tab, unread: { ...s.unread, [a.tab]: false } };

    case 'UPDATE': {
      const [s1, d] = ensureDraft(s, a.ref);
      if (!d || d.phase === 'sending') return s;
      const next: Draft = { ...d, ...a.patch };
      // 文章が変わったら、意味の確認はやり直し
      if (a.patch.text !== undefined && a.patch.text !== d.text) {
        next.clarChoice = undefined;
        next.clarCustom = '';
      }
      return setDraft(s1, a.ref, next);
    }

    case 'OPEN_ASK': {
      if (s.extra[a.role]?.phase === 'sending') return s;
      const ctx = a.role === 'patient' ? currentQuestion(s) : undefined;
      const d: Draft = {
        id: fmtId('M', s.nextId),
        role: a.role,
        mode: a.role === 'patient' ? 'ask' : 'clinician',
        replyTo: ctx?.id,
        ...emptyInputs(),
        text: a.text ?? '',
        sampleText: a.text,
        phase: 'input',
      };
      return { ...s, nextId: s.nextId + 1, extra: { ...s.extra, [a.role]: d } };
    }

    case 'OPEN_CORRECTION': {
      const t = findMessage(s, a.messageId);
      if (!t || t.from !== a.role || s.extra[a.role]?.phase === 'sending') return s;
      const d: Draft = {
        id: fmtId('C', s.nextId),
        role: a.role,
        mode: t.mode,
        questionKey: t.mode === 'clinician' ? undefined : t.questionKey,
        replyTo: t.replyTo,
        correctionOf: t.id,
        ...t.current.inputs,
        sampleText: t.current.inputs.text || undefined,
        phase: 'input',
      };
      return { ...s, nextId: s.nextId + 1, extra: { ...s.extra, [a.role]: d } };
    }

    case 'CLOSE_EXTRA':
      if (s.extra[a.role]?.phase === 'sending') return s;
      return { ...s, extra: { ...s.extra, [a.role]: null } };

    case 'SEND_START': {
      const d = getDraft(s, a.ref);
      // 送信中の連打は無視
      if (!d || d.phase === 'sending') return s;
      const c = sendable(s, d);
      if (c.status !== 'ready' || c.unchanged) return s;
      return setDraft(s, a.ref, { ...d, phase: 'sending', token: a.token });
    }

    case 'SEND_COMPLETE': {
      const d = getDraft(s, a.ref);
      // リセット後・別の送信の結果は無視
      if (!d || d.phase !== 'sending' || d.token !== a.token) return s;
      if (s.networkError) {
        // 相手には表示せず、下書きを保持する
        return setDraft(s, a.ref, { ...d, phase: 'failed', token: undefined });
      }
      const c = composeDraft(d);
      if (c.status !== 'ready') return setDraft(s, a.ref, { ...d, phase: 'input', token: undefined });

      let messages = s.messages;
      let answerDrafts = s.answerDrafts;
      if (d.correctionOf) {
        messages = messages.map((m) => {
          if (m.id !== d.correctionOf || m.correction?.id === d.id) return m;
          return {
            ...m,
            questionKey: m.mode === 'clinician' ? c.content.sampleKey : m.questionKey,
            previous: [...m.previous, m.current],
            current: c.content,
            correction: { id: d.id, seen: false },
          };
        });
        // 質問が訂正されたら、その質問への回答下書きは作り直す
        if (d.mode === 'clinician' && answerDrafts[d.correctionOf]) {
          answerDrafts = { ...answerDrafts };
          delete answerDrafts[d.correctionOf];
        }
      } else if (!messages.some((m) => m.id === d.id)) {
        messages = [
          ...messages,
          {
            id: d.id,
            from: d.role,
            kind: d.mode === 'answer-free' || d.mode === 'answer-choice' ? 'answer' : 'question',
            replyTo: d.replyTo,
            mode: d.mode,
            questionKey: d.mode === 'clinician' ? c.content.sampleKey : d.questionKey,
            current: c.content,
            previous: [],
          },
        ];
      }
      const recipient = other(d.role);
      const s2 = setDraft({ ...s, messages, answerDrafts }, a.ref, null);
      return {
        ...s2,
        unread: s.activeTab === recipient ? s.unread : { ...s.unread, [recipient]: true },
      };
    }

    case 'ACK_CORRECTION':
      return {
        ...s,
        messages: s.messages.map((m) =>
          m.id === a.messageId && m.correction ? { ...m, correction: { ...m.correction, seen: true } } : m,
        ),
      };
  }
}

// ---------- 表示用の状態ラベル ----------

export type StatusKey = 'none' | 'draft' | 'confirming' | 'sending' | 'received' | 'failed' | 'corrected';

export function draftStatus(s: AppState, d: Draft): StatusKey {
  switch (d.phase) {
    case 'sending':
      return 'sending';
    case 'failed':
      return 'failed';
    case 'clarify':
    case 'confirm':
      return 'confirming';
    case 'input': {
      const oneScreen = d.mode !== 'answer-free';
      return oneScreen && sendable(s, d).status === 'ready' ? 'confirming' : 'draft';
    }
  }
}

export function messageStatus(m: Message): StatusKey {
  return m.correction ? 'corrected' : 'received';
}
