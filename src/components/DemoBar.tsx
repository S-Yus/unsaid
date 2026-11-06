import { useState, type Dispatch } from 'react';
import { ERROR_TIP, SCENARIOS } from '../data';
import type { Action } from '../state';
import type { AppState, ScenarioId } from '../types';

/** 発表者用のデモ操作。アプリ本体とは配色・枠線を変えて区別する */
export function DemoBar({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const [showSteps, setShowSteps] = useState(false);
  const sc = SCENARIOS.find((s) => s.id === state.scenario)!;
  return (
    <header className="demobar" aria-label="デモ操作（発表者用）">
      <div className="demobar-row">
        <span className="demobar-badge">DEMO</span>
        <strong className="demobar-warning">デモ：実際の診療には使用できません</strong>
        <div className="demobar-controls">
          <select
            aria-label="シナリオ"
            value={state.scenario}
            onChange={(e) => dispatch({ type: 'RESET', scenario: e.target.value as ScenarioId })}
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="button" className="demobar-btn" onClick={() => dispatch({ type: 'RESET' })}>
            リセット
          </button>
          <label className={`demobar-switch ${state.networkError ? 'is-on' : ''}`}>
            <input
              type="checkbox"
              role="switch"
              checked={state.networkError}
              onChange={(e) => dispatch({ type: 'SET_ERROR', on: e.target.checked })}
            />
            <span className="demobar-switch-track" aria-hidden="true" />
            <span>通信エラー {state.networkError ? 'ON' : 'OFF'}</span>
          </label>
          <button type="button" className="demobar-btn" aria-expanded={showSteps} onClick={() => setShowSteps((v) => !v)}>
            手順
          </button>
        </div>
      </div>
      {showSteps && (
        <div className="demobar-steps">
          <ol>
            {sc.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p>エラーの確認：{ERROR_TIP}</p>
          <p>会話・音声入力・翻訳はすべてデモ用の固定サンプルです。</p>
        </div>
      )}
    </header>
  );
}
