import { useCallback, useReducer } from 'react';
import { DemoBar } from './components/DemoBar';
import { PatientScreen } from './components/PatientScreen';
import { ClinicianScreen } from './components/ClinicianScreen';
import { initialState, reducer, SEND_DELAY_MS } from './state';
import type { DraftRef, Role } from './types';

let tokenSeq = 0;

export default function App() {
  // メモリ内のみで管理。リロードで初期状態に戻る
  const [state, dispatch] = useReducer(reducer, 's1', initialState);

  const send = useCallback((ref: DraftRef) => {
    const token = `t${++tokenSeq}`;
    dispatch({ type: 'SEND_START', ref, token });
    window.setTimeout(() => dispatch({ type: 'SEND_COMPLETE', ref, token }), SEND_DELAY_MS);
  }, []);

  const tab = (r: Role, label: string, sub: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={state.activeTab === r}
      className={`tab ${state.activeTab === r ? 'tab--active' : ''}`}
      onClick={() => dispatch({ type: 'SET_TAB', tab: r })}
    >
      <span className="tab-label">{label}</span>
      <span className="tab-sub">{sub}</span>
      {state.unread[r] && <span className="tab-new">新着</span>}
    </button>
  );

  return (
    <div className="app">
      <DemoBar state={state} dispatch={dispatch} />
      <nav className="tabs" role="tablist" aria-label="画面切り替え">
        {tab('patient', '患者', '日本語')}
        {tab('clinician', '医療者', 'English')}
      </nav>
      <main className="screens" data-active={state.activeTab}>
        <PatientScreen state={state} dispatch={dispatch} send={send} />
        <ClinicianScreen state={state} dispatch={dispatch} send={send} />
      </main>
    </div>
  );
}
