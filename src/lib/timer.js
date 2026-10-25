// The kitchen timer's start/stop, shared by the tomato on the board and the live
// dock, so stopping from either puts the same thing on the sticker chart.

// Left running long past the bell, it logs what you set rather than the hours
export const FORGOT_MS = 30 * 60000;

const patchTimer = (updateBoard, boardId, modId, patch) =>
  updateBoard(boardId, (b) => ({
    ...b,
    modules: b.modules.map((m) => (m.id === modId ? { ...m, state: { ...m.state, ...patch } } : m)),
  }));

export const startTimer = ({ updateBoard }, boardId, modId) =>
  patchTimer(updateBoard, boardId, modId, { startedAt: Date.now() });

// state is the timer's { preset, startedAt }; log=false just puts the timer away
export function stopTimer({ updateBoard, logPractice, undoLog, toast }, boardId, modId, state, log) {
  const { preset = 20, startedAt } = state;
  patchTimer(updateBoard, boardId, modId, { startedAt: null });
  if (!log || !startedAt) return;
  const elapsed = Math.max(0, Date.now() - startedAt);
  const over = elapsed - preset * 60000 > FORGOT_MS;
  const mins = over ? preset : Math.round(elapsed / 60000);
  if (mins < 1) {
    toast({ text: "under a minute, not logged" });
    return;
  }
  const entry = logPractice(boardId, `⏱ ${mins} min`, { mins });
  toast({
    text: over ? `forgot me? logged the ${mins} you set` : `${mins} min on the chart ✓`,
    actions: [{ label: "undo", run: () => undoLog(entry) }],
  });
}
