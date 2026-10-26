import { shiftWk, today } from '../core/domain.js';
import { MV, USER, V, redo, undo } from '../core/state.js';
import { dupTomorrow, removeBlock, toggleDone } from '../week/actions.js';
import { E, closeEditor, openEditor } from '../week/editor.js';
import { DRAG, blockTarget, copyBlock, finish, pasteBlock } from '../week/drag.js';
import { backToThisWeek, goWeek, scrollToMinute } from '../week/nav.js';
import { M, closeModal } from '../ui/modal.js';
import { RT, closeRitual } from '../pages/rituals.js';
import { RV, closeReview, rvGo } from '../pages/review.js';
import { goMonth, setView, shiftYM } from '../month/month.js';
import { F, closeFocus } from '../ui/focus.js';
import { SETTLE, closeSettle } from '../side/settle.js';
import { openShortcuts } from '../ui/shortcuts.js';
import { IB, closeIbx, ibx, openIbx } from '../inbox/float.js';

export function setup() {
  /* ================= keyboard ================= */
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    if (SETTLE) { if (e.key === 'Escape') { e.preventDefault(); closeSettle(false); } return; }
    if (e.key === 'Escape' && DRAG && DRAG.active) { e.preventDefault(); finish(true); return; }
    if (e.key === 'Escape') { if (F) closeFocus(); else if (RV) closeReview(); else if (M) { if (!(M === 'user' && !USER)) closeModal(); } else if (RT) closeRitual(); else if (IB.open && ibx.contains(document.activeElement)) closeIbx(); else if (E) closeEditor(); return; }
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (RT && !M && !RV) return;
    if (RV && !typing) { if (e.key === 'ArrowLeft') { e.preventDefault(); rvGo(-1); } else if (e.key === 'ArrowRight') { e.preventDefault(); rvGo(1); } return; }
    if (mod && !typing && !M && !F && ((k === 'z' && e.shiftKey) || (k === 'y' && !e.shiftKey))) { e.preventDefault(); if (E) closeEditor(true); redo(); return; }
    if (mod && k === 'z' && !typing) { e.preventDefault(); if (E) closeEditor(true); undo(); return; }
    if (mod && !typing && !M && !F && !E && !MV && k === 'c' && !String(getSelection())) { const id = blockTarget(); if (id) { e.preventDefault(); copyBlock(id); } return; }
    if (mod && !typing && !M && !F && !E && !MV && k === 'v') { if (V.clip) { e.preventDefault(); pasteBlock(); } return; }
    if (typing || M || F || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '?') { e.preventDefault(); openShortcuts(); return; }
    if (k === 'n') { e.preventDefault(); openIbx(); return; }
    if (k === 'm') { e.preventDefault(); setView(MV ? 'week' : 'month'); return; }
    if (MV) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goMonth(shiftYM(MV.ym, -1), -1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goMonth(shiftYM(MV.ym, 1), 1); }
      else if (k === 't') backToThisWeek();
      return;
    }
    const bid = E ? null : blockTarget();
    if (bid) {
      if (e.key === ' ') { e.preventDefault(); toggleDone(bid); return; }
      if (e.key === 'Enter' || k === 'e') { e.preventDefault(); openEditor(bid); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); V.hoverId = null; removeBlock(bid); return; }
      if (k === 'd') { e.preventDefault(); dupTomorrow(bid); return; }
    }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goWeek(shiftWk(V.wk, -1), -1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); goWeek(shiftWk(V.wk, 1), 1); }
    else if (e.key === 't' || e.key === 'T') { const t = today(); if (V.wk !== t.wk) goWeek(t.wk, t.wk > V.wk ? 1 : -1); scrollToMinute(t.m, true); }
  });
}
