import { useEffect, useRef, type Dispatch, type ReactNode } from 'react';
import { CHOICE_ANSWERS, FREE_ANSWERS, PATIENT_ASK_SAMPLES } from '../data';
import { ambiguityFor, composeDraft, emptyInputs } from '../compose';
import { answerModeFor, currentQuestion, draftStatus, findMessage, getDraft, messageStatus, sendable, type Action, type StatusKey } from '../state';
import type { AppState, Content, Draft, DraftRef, Message } from '../types';
import { Badge, DemoSamples, DemoTag, Notice, PanelHeader, Spinner, StatusPill } from './common';

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  send: (ref: DraftRef) => void;
}

const NO_TRANSLATION = 'モックでは、この文章の翻訳は生成されません';

export function PatientScreen({ state, dispatch, send }: Props) {
  const q = currentQuestion(state);
  const extra = state.extra.patient;
  const ref: DraftRef | null = extra ? { role: 'patient', slot: 'extra' } : q ? { role: 'patient', slot: q.id } : null;
  const stored = ref ? getDraft(state, ref) : null;
  // 回答の下書きは最初の操作で作られる。それまでは空の下書きとして表示する
  const draft: Draft | null =
    stored ??
    (q
      ? {
          id: '',
          role: 'patient',
          mode: answerModeFor(q.questionKey),
          questionKey: q.questionKey,
          replyTo: q.id,
          ...emptyInputs(),
          sampleText: FREE_ANSWERS[q.questionKey ?? '']?.voice,
          phase: 'input',
        }
      : null);

  let status: StatusKey = 'none';
  if (stored && (stored.phase !== 'input' || stored.text || stored.choice)) status = draftStatus(state, stored);
  else {
    const mine = [...state.messages].reverse().find((m) => m.from === 'patient');
    if (mine) status = messageStatus(mine);
  }

  const update = (patch: Partial<Draft>) => ref && dispatch({ type: 'UPDATE', ref, patch });
  const doSend = () => ref && send(ref);
  const openAsk = (text?: string) => dispatch({ type: 'OPEN_ASK', role: 'patient', text });
  const cancelExtra = () => dispatch({ type: 'CLOSE_EXTRA', role: 'patient' });
  const answerComposer = (d: Draft) =>
    d.mode === 'answer-choice' ? (
      <ChoiceComposer state={state} draft={d} update={update} onSend={doSend} />
    ) : (
      <FreeComposer state={state} draft={d} update={update} onSend={doSend} />
    );

  return (
    <section className="panel panel--patient" aria-label="患者画面">
      <PanelHeader role="患者" lang="日本語" statusLabel="送信状態" status={status} statusLang="ja" />

      <History state={state} label="会話履歴" empty="まだ会話はありません。">
        {state.messages.map((m) =>
          m.from === 'clinician' ? (
            <Incoming key={m.id} m={m} dispatch={dispatch} />
          ) : (
            <Own key={m.id} m={m} dispatch={dispatch} disabled={!!extra} />
          ),
        )}
      </History>

      <div className="composer">
        {extra ? (
          <>
            <div className="composer-heading">
              <strong>{extra.mode === 'ask' ? '自分から質問する' : '回答を訂正する'}</strong>
              <button type="button" className="btn btn--link" onClick={cancelExtra} disabled={extra.phase === 'sending'}>
                やめる
              </button>
            </div>
            {extra.mode === 'ask' ? <AskComposer state={state} draft={extra} update={update} onSend={doSend} /> : answerComposer(extra)}
          </>
        ) : q && draft ? (
          <>
            {draft.phase === 'input' && (
              <div className="question-card">
                <p className="question-card-text">{q.current.translation}</p>
                <DemoTag>デモ用の翻訳</DemoTag>
              </div>
            )}
            {answerComposer(draft)}
          </>
        ) : (
          <p className="waiting">医療者からの質問を待っています。</p>
        )}

        {!extra && draft?.phase !== 'sending' && (
          <div className="sub-actions">
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => openAsk()}>
              自分から質問する
            </button>
            {q && (
              <button type="button" className="btn btn--link" onClick={() => openAsk('質問が分かりません')}>
                質問が分からない
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- 履歴 ----------

export function History({ state, label, empty, children }: { state: AppState; label: string; empty: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const sig = state.messages.map((m) => m.id + (m.correction?.id ?? '')).join();
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sig]);
  return (
    <div className="history" ref={ref} role="log" aria-label={label}>
      {state.messages.length === 0 && <p className="history-empty">{empty}</p>}
      {children}
    </div>
  );
}

function Incoming({ m, dispatch }: { m: Message; dispatch: Dispatch<Action> }) {
  return (
    <article className={`msg msg--in ${m.correction && !m.correction.seen ? 'msg--attention' : ''}`}>
      <div className="msg-who">医療者</div>
      <p className="msg-main">{m.current.translation}</p>
      {m.correction && (
        <div className="msg-foot">
          <Badge tone="corrected">訂正済み</Badge>
          {m.correction.seen ? (
            <span className="msg-meta">✓ 確認済み</span>
          ) : (
            <button type="button" className="btn btn--primary btn--sm" onClick={() => dispatch({ type: 'ACK_CORRECTION', messageId: m.id })}>
              訂正を確認しました
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function Own({ m, dispatch, disabled }: { m: Message; dispatch: Dispatch<Action>; disabled: boolean }) {
  return (
    <article className="msg msg--own">
      <div className="msg-who">あなた</div>
      <Points c={m.current} />
      {showOriginal(m.current) && <p className="content-sub">元の発言：{m.current.original}</p>}
      {m.previous.length > 0 && (
        <details className="msg-detail">
          <summary>以前の回答</summary>
          {m.previous.map((p, i) => (
            <p key={i} className="msg-old">
              {(p.points ?? [p.original]).join('、')}
            </p>
          ))}
        </details>
      )}
      <div className="msg-foot">
        <StatusPill status={messageStatus(m)} lang="ja" />
        {m.correction && <span className="msg-meta">{m.correction.seen ? '✓ 相手が訂正を確認しました' : '相手の確認待ち'}</span>}
        {m.kind === 'answer' && (
          <button
            type="button"
            className="btn btn--link msg-action"
            onClick={() => dispatch({ type: 'OPEN_CORRECTION', role: 'patient', messageId: m.id })}
            disabled={disabled}
          >
            訂正する
          </button>
        )}
      </div>
    </article>
  );
}

const showOriginal = (c: Content) =>
  !!c.points && c.inputs.choice === undefined && !(c.points.length === 1 && c.points[0] === c.original);

function Points({ c, large }: { c: Content; large?: boolean }) {
  return (
    <ul className={`points ${large ? 'points--large' : ''}`}>
      {(c.points ?? [c.original]).map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ul>
  );
}

// ---------- 自由回答（必要なときだけ意味を確認） ----------

interface ComposerProps {
  state: AppState;
  draft: Draft;
  update: (p: Partial<Draft>) => void;
  onSend: () => void;
}

function FreeComposer({ state, draft, update, onSend }: ComposerProps) {
  const set = FREE_ANSWERS[draft.questionKey ?? ''];
  const c = composeDraft(draft);
  const correction = !!draft.correctionOf;

  if (draft.phase === 'clarify') {
    const amb = ambiguityFor(draft.questionKey ?? '', draft.text);
    if (!amb) return null;
    const custom = draft.clarChoice === 'custom';
    return (
      <div className="step">
        <h3 className="clarify-heading">{amb.heading}</h3>
        <div className="options" role="group" aria-label={amb.heading}>
          {amb.options.map((o) => (
            <OptionButton key={o.key} selected={draft.clarChoice === o.key} onClick={() => update({ clarChoice: o.key, clarCustom: '', phase: 'confirm' })}>
              {o.ja}
            </OptionButton>
          ))}
          <OptionButton selected={custom} onClick={() => update({ clarChoice: 'custom' })}>
            自分で書く
          </OptionButton>
        </div>
        {custom && (
          <>
            <textarea aria-label="どんな感じか自分で書く" rows={2} value={draft.clarCustom} onChange={(e) => update({ clarCustom: e.target.value })} />
            {c.status === 'unsupportedClar' && (
              <Notice tone="warn">
                {NO_TRANSLATION}
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => update({ clarChoice: undefined, clarCustom: '' })}>
                  選択肢に戻る
                </button>
              </Notice>
            )}
            <button type="button" className="btn btn--primary" disabled={c.status !== 'ready'} onClick={() => update({ phase: 'confirm' })}>
              次へ
            </button>
          </>
        )}
        <button type="button" className="btn btn--link align-start" onClick={() => update({ phase: 'input' })}>
          ← 発言を修正する
        </button>
      </div>
    );
  }

  if (draft.phase !== 'input' && c.status === 'ready') {
    return (
      <ConfirmBlock
        state={state}
        draft={draft}
        content={c.content}
        onEdit={() => update({ phase: 'input' })}
        onRechoose={c.content.clarification ? () => update({ phase: 'clarify' }) : undefined}
        onSend={onSend}
      />
    );
  }

  const goNext = () => {
    if (c.status === 'needsClarification') update({ phase: 'clarify' });
    else if (c.status === 'ready') update({ phase: 'confirm' });
  };

  return (
    <div className="step">
      {set && !correction && (
        <button type="button" className="btn btn--voice align-start" onClick={() => update({ text: set.voice, sampleText: set.voice, phase: 'input' })}>
          <span aria-hidden="true">🎤</span> 音声入力を試す<span className="btn-demo">デモ</span>
        </button>
      )}
      <textarea
        aria-label={correction ? '訂正後の回答' : 'あなたの回答'}
        rows={2}
        value={draft.text}
        placeholder="回答を入力"
        onChange={(e) => update({ text: e.target.value, phase: 'input' })}
      />
      {c.status === 'unsupported' && (
        <Notice tone="warn">
          {NO_TRANSLATION}
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => update({ text: draft.sampleText ?? set?.voice ?? '' })}>
            サンプルに戻す
          </button>
        </Notice>
      )}
      {set && correction && <DemoSamples items={set.suggestions} onPick={(s) => update({ text: s, phase: 'input' })} />}
      <button type="button" className="btn btn--primary" disabled={c.status === 'empty' || c.status === 'unsupported'} onClick={goNext}>
        次へ
      </button>
    </div>
  );
}

// ---------- 選択式（明確な回答は一画面で送信） ----------

function ChoiceComposer({ state, draft, update, onSend }: ComposerProps) {
  const options = CHOICE_ANSWERS[draft.questionKey ?? ''] ?? [];
  const c = sendable(state, draft);
  const locked = draft.phase === 'sending';
  return (
    <div className="step">
      <div className="options options--grid" role="group" aria-label="回答を選択">
        {options.map((o) => (
          <OptionButton key={o.key} selected={draft.choice === o.key} disabled={locked} onClick={() => update({ choice: o.key, custom: '', phase: 'input' })}>
            {o.ja}
          </OptionButton>
        ))}
        <OptionButton selected={draft.choice === 'custom'} disabled={locked} onClick={() => update({ choice: 'custom', phase: 'input' })}>
          自分で書く
        </OptionButton>
      </div>
      {draft.choice === 'custom' && (
        <>
          <textarea aria-label="回答を自分で書く" rows={2} value={draft.custom} disabled={locked} onChange={(e) => update({ custom: e.target.value, phase: 'input' })} />
          {c.status === 'unsupported' && (
            <Notice tone="warn">
              {NO_TRANSLATION}
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => update({ choice: undefined, custom: '' })}>
                選択肢に戻る
              </button>
            </Notice>
          )}
        </>
      )}
      {c.status === 'ready' ? (
        <ConfirmBlock state={state} draft={draft} content={c.content} onSend={onSend} />
      ) : (
        <button type="button" className="btn btn--primary" disabled>
          {draft.correctionOf ? '訂正を送信' : '送信'}
        </button>
      )}
    </div>
  );
}

// ---------- 自分から質問する ----------

function AskComposer({ state, draft, update, onSend }: ComposerProps) {
  const c = composeDraft(draft);
  const locked = draft.phase === 'sending';
  return (
    <div className="step">
      <textarea
        aria-label="医療者に伝えたいこと"
        rows={2}
        value={draft.text}
        disabled={locked}
        placeholder="質問を入力"
        onChange={(e) => update({ text: e.target.value, phase: 'input' })}
      />
      {c.status === 'unsupported' && (
        <Notice tone="warn">
          {NO_TRANSLATION}
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => update({ text: draft.sampleText ?? PATIENT_ASK_SAMPLES[0].ja, phase: 'input' })}>
            サンプルに戻す
          </button>
        </Notice>
      )}
      <DemoSamples items={PATIENT_ASK_SAMPLES.map((s) => s.ja)} onPick={(s) => update({ text: s, sampleText: s, phase: 'input' })} disabled={locked} />
      {c.status === 'ready' ? (
        <ConfirmBlock state={state} draft={draft} content={c.content} onSend={onSend} />
      ) : (
        <button type="button" className="btn btn--primary" disabled>
          送信
        </button>
      )}
    </div>
  );
}

// ---------- 送信前確認 ----------

function ConfirmBlock({
  state,
  draft,
  content,
  onEdit,
  onRechoose,
  onSend,
}: {
  state: AppState;
  draft: Draft;
  content: Content;
  onEdit?: () => void;
  onRechoose?: () => void;
  onSend: () => void;
}) {
  const correction = !!draft.correctionOf;
  const target = findMessage(state, draft.correctionOf);
  const s = sendable(state, draft);
  const unchanged = s.status === 'ready' && !!s.unchanged;
  const sending = draft.phase === 'sending';
  const failed = draft.phase === 'failed';
  const sendLabel = failed ? '再送信' : correction ? '訂正を送信' : 'この内容で送信';
  const cl = content.clarification;

  return (
    <div className="confirm" aria-live="polite">
      <h3 className="confirm-title">{correction ? '訂正内容の確認' : '相手に伝える内容'}</h3>
      <Points c={content} large />
      {cl?.unresolved && <p className="content-sub">※「{cl.term}」の意味は確定していないことも伝えます</p>}
      {cl && (
        <p className="content-sub">
          「{cl.term}」→ {cl.choiceJa}
          {onRechoose && !sending && (
            <button type="button" className="btn btn--link btn--inline" onClick={onRechoose}>
              選び直す
            </button>
          )}
        </p>
      )}
      {correction && target && <p className="content-sub">訂正前：{(target.current.points ?? [target.current.original]).join('、')}</p>}
      {unchanged && <p className="content-sub">内容が変わっていません。</p>}
      {failed && <Notice tone="error">送信失敗：相手には届いていません。内容は残っています。</Notice>}
      <div className="actions">
        {onEdit && (
          <button type="button" className="btn btn--secondary" onClick={onEdit} disabled={sending}>
            修正する
          </button>
        )}
        <button type="button" className="btn btn--primary" onClick={onSend} disabled={sending || unchanged}>
          {sending ? (
            <>
              <Spinner /> 送信中…
            </>
          ) : (
            sendLabel
          )}
        </button>
      </div>
    </div>
  );
}

function OptionButton({ selected, onClick, disabled, children }: { selected: boolean; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" className={`option ${selected ? 'option--selected' : ''}`} aria-pressed={selected} onClick={onClick} disabled={disabled}>
      <span className="option-mark" aria-hidden="true">
        {selected ? '●' : '○'}
      </span>
      {children}
    </button>
  );
}
