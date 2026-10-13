// Plain function bodies for the pay page's tests (unit and component). Test code only: nothing in the app imports it.
export const TOKEN = "abcdefghijklmnopqrstuv";

export const noticeBody = {
  consent_needed: true,
  notice_version: "v1",
  tutor_name: "Meena Iyer",
  tutor_subjects: ["maths", "science"],
  student_name: "Ravi Kumar",
  language: "en",
};

export const feeBody = {
  ...noticeBody,
  consent_needed: false,
  upi_id: "meena.tuitions@okhdfc",
  today: "2026-10-12",
  total_remaining: 340000,
  open_dues: [
    { kind: "opening", month: null, due_date: "2026-08-01", amount: 100000, amount_paid: 0, remaining: 100000 },
    { kind: "monthly", month: "2026-09-01", due_date: "2026-09-01", amount: 120000, amount_paid: 20000, remaining: 100000 },
    { kind: "monthly", month: "2026-10-01", due_date: "2026-10-20", amount: 140000, amount_paid: 0, remaining: 140000 },
  ],
  open_dues_more: 0,
  receipts: [
    { receipt_no: 198, receipt_token: "Rq8mT2vXk4LpN7sYb3WcZd", month: "2026-08-01", amount: 120000, paid_on: "2026-09-03", balance_after: 0 },
    { receipt_no: 171, receipt_token: "Hj5nB9cVx2MqP6wEt8RyUa", month: null, amount: 50000, paid_on: "2026-08-12", balance_after: 50000 },
  ],
  receipts_more: false,
};
