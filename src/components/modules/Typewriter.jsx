import { useState, useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext";
import { dayKey } from "../../utils/date";
import { tone, click } from "../../lib/audio";
import { sendAll } from "../../lib/readings";
import { notesWords, wordCount } from "../../lib/studio";
import SendTo, { WireTag } from "../board/SendTo";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const BAR = 24; // typed x's across the page for the progress line
const fmt = (n) => n.toLocaleString();

// Today's words, and the honest limits of counting them:
//  - Notes: we can't see what was typed, only how many words are in the board's Notes
//    modules now. So each day starts with a baseline (the total when the day began, or
//    when this typewriter was first looked at) and today = total - baseline.
//    Deleting words below the baseline lowers the baseline too (the floor ratchets
//    down), so writing again after a cut still counts. Writing in one module and
//    deleting in another nets out; words in other boards' Notes aren't seen at all.
//  - The sheet: same trick on its own words, plus whatever you've torn off today.
export function wordsToday(state, today, notes, sheetWords) {
  if (state.day !== today) return 0;
  return Math.max(0, notes - (state.base ?? 0)) + Math.max(0, sheetWords - (state.sbase ?? 0)) + (state.banked ?? 0);
}

// A little portable typewriter. The paper in the roller says how many words you've written
// today; type on it directly, or just write in this board's Notes and it counts those too.
export default function Typewriter({ board, mod, setState, expanded }) {
  const { logPractice, undoLog, toast, updateBoard } = useData();
  const s = mod.state;
  const { goal = 500, clack = true, hard = false } = s;
  const today = dayKey();
  const [sheet, setSheet] = useState(s.sheet ?? "");
  const [lit, setLit] = useState(null);
  const litTimer = useRef(0);
  const notes = notesWords(board);
  const sheetW = wordCount(sheet);
  const words = wordsToday(s, today, notes, sheetW);

  // A new day starts a new baseline; deleting below the baseline lowers it
  useEffect(() => {
    if (s.day !== today) {
      setState((st) => ({ ...st, day: today, base: notes, sbase: sheetW, banked: 0 }));
    } else if (notes < (s.base ?? 0) || sheetW < (s.sbase ?? 0)) {
      setState((st) => ({ ...st, base: Math.min(st.base ?? 0, notes), sbase: Math.min(st.sbase ?? 0, sheetW) }));
    }
  }, [today, notes, sheetW, s.day, s.base, s.sbase, setState]);

  // The home glance can't see the board's Notes, so the count is kept in the module
  useEffect(() => {
    if (s.day !== today || (s.n === words && s.nday === today)) return;
    setState((st) => ({ ...st, n: words, nday: today }), { debounce: 1500 });
  }, [words, today, s.day, s.n, s.nday, setState]);

  // The goal, once a day: log it and send the number down the wires
  const fired = useRef(null);
  useEffect(() => {
    if (s.day !== today || goal < 1 || words < goal || s.loggedDay === today || fired.current === today) return;
    fired.current = today;
    setState((st) => ({ ...st, loggedDay: today }));
    const entry = logPractice(board.id, `⌨️ ${fmt(words)} words — goal!`);
    const sent = sendAll(updateBoard, board.id, s.sendTo, { value: words, unit: "words", label: "typewriter" });
    tone(1568, { dur: 0.7, gain: 0.12 });
    toast({
      text: `${fmt(words)} words, goal! ✓${sent ? " · sent" : ""}`,
      actions: [{ label: "undo", run: () => { undoLog(entry); fired.current = null; setState((st) => ({ ...st, loggedDay: null })); } }],
    });
  }, [words, goal, today, s.day, s.loggedDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const write = (v) => {
    setSheet(v);
    setState((st) => ({ ...st, sheet: v }), { debounce: 600 });
  };

  // Key sounds: a clack for each key, a bell on the return
  const onKeyDown = (e) => {
    if (hard && (e.key === "Backspace" || e.key === "Delete" || ((e.ctrlKey || e.metaKey) && /^[zxy]$/i.test(e.key)))) {
      e.preventDefault();
      return;
    }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key === " " ? " " : null;
    if (k) {
      setLit(k);
      clearTimeout(litTimer.current);
      litTimer.current = setTimeout(() => setLit(null), 110);
    }
    if (!clack || e.ctrlKey || e.metaKey) return;
    if (e.key === "Enter") {
      click(undefined, { accent: true, gain: 0.7 });
      tone(2349, { dur: 0.6, gain: 0.07 });
    } else if (k || e.key === "Backspace") {
      click(undefined, { gain: 0.55 });
      tone(140 + Math.random() * 40, { dur: 0.05, gain: 0.1, type: "triangle" });
    }
  };

  // Tear the sheet off: its words so far stay in today's count
  const tearOff = () => {
    if (!sheet.trim()) return;
    navigator.clipboard?.writeText(sheet).then(
      () => toast({ text: "the sheet is on your clipboard" }),
      () => {}
    );
    const kept = Math.max(0, sheetW - (s.sbase ?? 0));
    setSheet("");
    setState((st) => ({ ...st, sheet: "", sbase: 0, banked: (st.banked ?? 0) + kept }));
  };

  const filled = goal > 0 ? Math.min(BAR, Math.round((words / goal) * BAR)) : 0;
  const done = goal > 0 && words >= goal;

  return (
    <div className={`tw${expanded ? " big" : ""}${hard ? " hard" : ""}`}>
      <div className="tw-paper">
        <div className="tw-head">
          <span>today</span>
          <b>{fmt(words)}</b>
          <span>of {fmt(goal)} words</span>
          {done && <i className="tw-goal">GOAL!</i>}
        </div>
        <div className="tw-bar" aria-hidden="true">{"x".repeat(filled)}<em>{"·".repeat(BAR - filled)}</em></div>
        <textarea
          className="tw-sheet"
          value={sheet}
          onChange={(e) => write(e.target.value)}
          onKeyDown={onKeyDown}
          onCut={(e) => hard && e.preventDefault()}
          onPaste={(e) => hard && e.preventDefault()}
          placeholder={hard ? "no going back. just write." : "start typing…"}
          spellCheck={!hard}
          aria-label="The sheet in the typewriter"
        />
      </div>
      <div className="tw-machine" aria-hidden="true">
        <div className="tw-platen"><i /><i /></div>
        <div className="tw-keys">
          {ROWS.map((r, ri) => (
            <div key={r} className="tw-row" style={{ marginLeft: ri * 9 }}>
              {[...r].map((c) => <kbd key={c} className={lit === c ? "down" : ""}>{c}</kbd>)}
            </div>
          ))}
          <kbd className={`tw-space${lit === " " ? " down" : ""}`} />
        </div>
      </div>

      <div className="tw-opts">
        <label className="tw-goalbox">goal
          <input
            className="line-input"
            inputMode="numeric"
            defaultValue={goal}
            onChange={(e) => setState((st) => ({ ...st, goal: Math.max(1, parseInt(e.target.value, 10) || 1) }), { debounce: 600 })}
            aria-label="Daily word goal"
          />
        </label>
        <button className={`tw-sw${clack ? " on" : ""}`} aria-pressed={clack} onClick={() => setState((st) => ({ ...st, clack: !clack }))}>
          <i />clack
        </button>
        <button className={`tw-sw${hard ? " on" : ""}`} aria-pressed={hard} onClick={() => setState((st) => ({ ...st, hard: !hard }))} title="No backspace, no undo. Keep going.">
          <i />no backspace
        </button>
        <button className="mini-btn ghost" onClick={tearOff} disabled={!sheet.trim()} title="Copy the sheet and roll in a clean one">tear off</button>
      </div>
      <div className="tw-note">
        {notes > 0 ? `counts the ${fmt(Math.max(0, notes - (s.base ?? 0)))} new words in this board's Notes, too` : "words in this board's Notes count too"}
      </div>
      <WireTag board={board} mod={mod} />
      <SendTo fold board={board} mod={mod} setState={setState} note="the day's words go there when the goal is hit" />
    </div>
  );
}
