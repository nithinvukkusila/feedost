// Days after a monthly fee's due date before it counts as overdue (spec UX-review-fixes-2, criterion 1.2). The board
// (`dueState` in dues-board.ts) and the parent's pay page (`lateness` in pay-page-view.ts) both read it, so the two
// always agree. 0: overdue from the day after the due date. An earlier balance ignores it. This file has no imports
// and must never get one: the parent's pay page loads it, and its shell may not grow the roster, the board or the
// Supabase client through it (pay-page-code-rules.test.ts checks this).
export const GRACE_DAYS = 0;
