import type { Dispatch } from 'react';
import { CLINICIAN_SAMPLES } from '../data';
import { draftStatus, findMessage, messageStatus, sendable, type Action, type StatusKey } from '../state';
import type { AppState, Content, Draft, DraftRef, Message } from '../types';
import { Badge, DemoSamples, DemoTag, Notice, PanelHeader, Spinner, StatusPill } from './common';
import { History } from './PatientScreen';

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  send: (ref: DraftRef) => void;
}

const ROMAJI: Record<string, string> = { 苦しい: 'kurushii' };
const REF: DraftRef = { role: 'clinician', slot: 'extra' };

export function ClinicianScreen({ state, dispatch, send }: Props) {
  const draft = state.extra.clinician;

  let status: StatusKey = 'none';
  if (draft && (draft.phase !== 'input' || draft.text)) status = draftStatus(state, draft);
  else {
    const mine = [...state.messages].reverse().find((m) => m.from === 'clinician');
    if (mine) status = messageStatus(mine);
  }

  return (
    <section className="panel panel--clinician" aria-label="Clinician screen" lang="en">
      <PanelHeader role="Clinician" lang="English" statusLabel="Send status" status={status} statusLang="en" />

      <History state={state} label="Conversation" empty="No messages yet.">
        {state.messages.map((m) =>
          m.from === 'patient' ? <Incoming key={m.id} m={m} state={state} dispatch={dispatch} /> : <Own key={m.id} m={m} />,
        )}
      </History>

      <div className="composer">
        {draft ? (
          <Composer state={state} dispatch={dispatch} send={send} />
        ) : (
          <div className="sub-actions">
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => dispatch({ type: 'OPEN_ASK', role: 'clinician' })}>
              Ask a question
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Incoming({ m, state, dispatch }: { m: Message; state: AppState; dispatch: Dispatch<Action> }) {
  const q = findMessage(state, m.replyTo);
  const needsAck = m.correction && !m.correction.seen;
  return (
    <article className={`msg msg--in ${m.correction ? 'msg--corrected' : ''} ${needsAck ? 'msg--attention' : ''}`}>
      <div className="msg-who">
        Patient
        {q && <span className="msg-reply">{m.kind === 'answer' ? `Re: ${q.current.original}` : 'Question'}</span>}
      </div>
      {(m.correction || m.current.clarification?.unresolved) && (
        <div className="msg-badges">
          {m.correction && <Badge tone="corrected">Corrected</Badge>}
          {m.current.clarification?.unresolved && <Badge tone="warn">Meaning not confirmed</Badge>}
        </div>
      )}
      <PatientContent c={m.current} />
      {m.previous.length > 0 && (
        <details className="msg-detail">
          <summary>Previous answer</summary>
          {m.previous.map((p, i) => (
            <p key={i} className="msg-old">
              {p.translation}
            </p>
          ))}
        </details>
      )}
      {m.correction && (
        <div className="msg-foot">
          {m.correction.seen ? (
            <span className="msg-meta">✓ Correction seen</span>
          ) : (
            <button type="button" className="btn btn--primary btn--sm" onClick={() => dispatch({ type: 'ACK_CORRECTION', messageId: m.id })}>
              Mark correction as seen
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/** 本人が確認した内容（翻訳）と、元の発言を分けて表示 */
function PatientContent({ c }: { c: Content }) {
  const cl = c.clarification;
  return (
    <>
      <p className="msg-main">
        {c.translation} <DemoTag>Demo translation</DemoTag>
      </p>
      {cl && (
        <p className="content-sub">
          “{cl.term}” ({ROMAJI[cl.term] ?? ''}) → {cl.unresolved ? 'patient could not describe it' : `closest to “${cl.choiceEn}”`}
        </p>
      )}
      <details className="msg-detail">
        <summary>Original words (Japanese)</summary>
        <p lang="ja">{c.original}</p>
      </details>
    </>
  );
}

function Own({ m }: { m: Message }) {
  return (
    <article className="msg msg--own">
      <div className="msg-who">You</div>
      <p className="msg-main">{m.current.original}</p>
      <div className="msg-foot">
        <StatusPill status={messageStatus(m)} lang="en" />
      </div>
    </article>
  );
}

/** 明確な質問は一画面で確認して送信 */
function Composer({ state, dispatch, send }: Props) {
  const draft = state.extra.clinician!;
  const update = (patch: Partial<Draft>) => dispatch({ type: 'UPDATE', ref: REF, patch });
  const c = sendable(state, draft);
  const sending = draft.phase === 'sending';
  const failed = draft.phase === 'failed';

  return (
    <div className="step">
      <div className="composer-heading">
        <strong>Your message</strong>
        <button type="button" className="btn btn--link" onClick={() => dispatch({ type: 'CLOSE_EXTRA', role: 'clinician' })} disabled={sending}>
          Cancel
        </button>
      </div>
      <textarea
        aria-label="Message in English"
        rows={2}
        value={draft.text}
        disabled={sending}
        placeholder="Type a question"
        onChange={(e) => update({ text: e.target.value, phase: 'input' })}
      />
      {c.status === 'unsupported' && (
        <Notice tone="warn">
          In this mock, no translation is generated for this text.
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => update({ text: draft.sampleText ?? CLINICIAN_SAMPLES[0].en, phase: 'input' })}>
            Restore sample
          </button>
        </Notice>
      )}
      {!draft.text && (
        <DemoSamples items={CLINICIAN_SAMPLES.map((s) => s.en)} onPick={(s) => update({ text: s, sampleText: s, phase: 'input' })} />
      )}
      {failed && <Notice tone="error">Failed to send. The patient has not received it. Your draft is kept.</Notice>}
      <button type="button" className="btn btn--primary" onClick={() => send(REF)} disabled={sending || c.status !== 'ready'}>
        {sending ? (
          <>
            <Spinner /> Sending…
          </>
        ) : failed ? (
          'Retry'
        ) : (
          'Send'
        )}
      </button>
    </div>
  );
}
