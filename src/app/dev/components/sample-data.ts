// All text shown on /dev/components. The page is an internal tool, not a user-facing screen, so its
// words live here and not in messages/*.json (spec F2, open question 1). Components hold no strings:
// everything below is passed to them as props.
// The Hindi, Kannada and Telugu strings are drafts for checking how the scripts set. A native speaker
// has not reviewed them; do not copy them into messages/*.json.

import { formatDate, formatRupees } from "@/lib/format";

export type Lang = "en" | "hi" | "kn" | "te";

export const langs: Lang[] = ["en", "hi", "kn", "te"];
export const indicLangs: Lang[] = ["hi", "kn", "te"];

export const langNames: Record<Lang, string> = {
  en: "English",
  hi: "Hindi",
  kn: "Kannada",
  te: "Telugu",
};

/** Amounts and dates come from the formatters. `allDigits` and `rupee` stay literal: they test the glyphs. */
export const figures = {
  large: formatRupees(12345600),
  largeRest: formatRupees(7890000),
  sixWide: formatRupees(98765000),
  sevenDigits: formatRupees(999999900),
  row: formatRupees(120000),
  rowLarge: formatRupees(12345600),
  allDigits: "₹0123456789",
  rupee: "₹",
  date: formatDate("2026-10-08"),
  fee: formatRupees(1850000),
};

/** What the Formats section feeds the formatters, and the paise values it shows. */
export const formatInputs = {
  paise: [0, 99, 100000, 12345600],
  date: "2026-10-08",
  phone: "+919876543210",
};

export type Sample = {
  headline: string;
  pending: string;
  sentence: string;
  caption: string;
  label: string;
  button: {
    remind: string;
    markPaid: string;
    share: string;
    long: string;
    busy: string;
    disabledReason: string;
    roundLabel: string;
    next: string;
  };
  tag: { overdue: string; due: string; partPaid: string; paid: string; long: string };
  stamp: {
    paid: string;
    sent: string;
    allPaid: string;
    paidLabel: string;
    sentLabel: string;
    allPaidLabel: string;
    count: string;
    month: string;
  };
  row: {
    name: string;
    name2: string;
    name3: string;
    longName: string;
    metaOverdue: string;
    metaDue: string;
    metaPaid: string;
    longMeta: string;
    openLabel: string;
  };
  field: {
    label: string;
    longLabel: string;
    placeholder: string;
    value: string;
    partial: string;
    wrong: string;
    correctLabel: string;
    correctMessage: string;
    errorLabel: string;
    errorMessage: string;
    errorShort: string;
    helper: string;
  };
  tabs: {
    listLabel: string;
    overdue: string;
    due: string;
    paid: string;
    longOverdue: string;
    longDue: string;
    longPaid: string;
  };
  sheet: {
    title: string;
    close: string;
    contextLabel: string;
    contextTitle: string;
    body: string;
    open: string;
  };
  segmented: {
    paidBy: string;
    upi: string;
    cash: string;
    tone: string;
    polite: string;
    politeDetail: string;
    firm: string;
    firmDetail: string;
    when: string;
    today: string;
    yesterday: string;
    pickDate: string;
    language: string;
    english: string;
    hindi: string;
    kannada: string;
    telugu: string;
    longLabel: string;
    longA: string;
    longB: string;
  };
  switch: { name: string; on: string; off: string; longOn: string; longOff: string; visibleLabel: string };
  /** `{n}`, `{t}`, `{p}`, `{d}` and `{o}` are filled with counts by the strip section. */
  strip: { paid: string; due: string; overdue: string; label: string; longPaid: string; longDue: string; longOverdue: string };
  nav: { label: string; home: string; students: string; attendance: string; more: string; longStudents: string; longAttendance: string };
  /** `{amount}` in `undoMessage` is filled with a sample amount by the banner section. */
  banner: {
    offlineTitle: string;
    offlineDetail: string;
    errorTitle: string;
    errorDetail: string;
    longErrorDetail: string;
    retry: string;
    later: string;
    longRetry: string;
    longLater: string;
    undoMessage: string;
    undo: string;
    sendReceipt: string;
    longUndo: string;
    longSend: string;
  };
};

export const sample: Record<Lang, Sample> = {
  en: {
    headline: "Fees collected. Not chased.",
    pending: "Still to come in",
    sentence: "from 9 of your 23 students",
    caption: "Reminded 2 days ago. Pay page opened once.",
    label: "Receipt no. 215",
    button: {
      remind: "Remind",
      markPaid: "Mark paid",
      share: "Share pay link",
      long: "Remind all 5 parents on WhatsApp about this month's fees",
      busy: "Opening WhatsApp…",
      disabledReason: "Add a parent's phone number first.",
      roundLabel: "Remind Ravi's parent on WhatsApp",
      next: "Next: add students",
    },
    tag: {
      overdue: "Overdue 7 days",
      due: "Due 12 Oct",
      partPaid: "Part paid",
      paid: "Paid",
      long: "Overdue 37 days, reminded twice",
    },
    stamp: {
      paid: "PAID",
      sent: "SENT",
      allPaid: "ALL PAID",
      paidLabel: "Stamped paid on 08 Oct 2026",
      sentLabel: "Stamped sent, 1 of 5",
      allPaidLabel: "Stamped all paid, October 2026",
      count: "1 of 5",
      month: "Oct 2026",
    },
    row: {
      name: "Ravi Kumar",
      name2: "Ananya Sharma",
      name3: "Farhan Sheikh",
      longName: "Venkatasubrahmanyalakshminarasimharao Chintalapati",
      metaOverdue: "7 days late",
      metaDue: "Due on the 12th",
      metaPaid: "Paid 08 Oct 2026 by UPI",
      longMeta: "37 days late, reminded twice, pay page opened once",
      openLabel: "Open",
    },
    field: {
      label: "Your UPI ID",
      longLabel: "The UPI ID where parents should send this month's tuition fees",
      placeholder: "name@bank",
      value: "meena.tuitions@okhdfc",
      partial: "meena.tui",
      wrong: "meena.tuitions",
      correctLabel: "correct",
      correctMessage: "That looks like a valid UPI ID.",
      errorLabel: "needs fixing",
      errorMessage: "This is missing the part after @. A UPI ID looks like name@bank",
      errorShort: "Add the part after @, like name@bank",
      helper: "Parents pay you directly to this ID.",
    },
    tabs: {
      listLabel: "Fee status",
      overdue: "Overdue",
      due: "Due",
      paid: "Paid",
      longOverdue: "Overdue this month",
      longDue: "Due this week",
      longPaid: "Paid and confirmed",
    },
    sheet: {
      title: "Mark paid",
      close: "Cancel",
      contextLabel: "Class 10 Maths · October",
      contextTitle: "Ravi Kumar",
      body: "Receipt no. 215 is made for you. Send it on WhatsApp next.",
      open: "Open the sheet",
    },
    segmented: {
      paidBy: "Paid by",
      upi: "UPI",
      cash: "Cash",
      tone: "Tone",
      polite: "Polite",
      politeDetail: "A gentle first nudge",
      firm: "Firm",
      firmDetail: "When it is well overdue",
      when: "When",
      today: "Today",
      yesterday: "Yesterday",
      pickDate: "Pick date",
      language: "Language",
      english: "English",
      hindi: "Hindi",
      kannada: "Kannada",
      telugu: "Telugu",
      longLabel: "Choose the tone of this month's fee reminder to every parent in the batch",
      longA: "A polite first reminder this week",
      longB: "A firm final reminder",
    },
    switch: {
      name: "Automatic reminders",
      on: "ON",
      off: "OFF",
      longOn: "SENDING",
      longOff: "PAUSED",
      visibleLabel: "Monthly report to parents",
    },
    strip: {
      paid: "{n} paid",
      due: "{n} due, hollow",
      overdue: "{n} overdue, tall",
      label: "{t} students: {p} paid, {d} due, {o} overdue",
      longPaid: "{n} paid and confirmed this month",
      longDue: "{n} due this week, hollow",
      longOverdue: "{n} overdue by more than a week, tall",
    },
    nav: {
      label: "Main",
      home: "Home",
      students: "Students",
      attendance: "Attendance",
      more: "More",
      longStudents: "Students and batches",
      longAttendance: "Attendance register",
    },
    banner: {
      offlineTitle: "You are offline",
      offlineDetail: "3 changes are saved on this phone. They will sync when the network is back.",
      errorTitle: "Couldn't save just now",
      errorDetail: "The network dropped. Nothing is lost. Your changes are kept on this phone.",
      longErrorDetail: "The network dropped. Nothing is lost. Your changes are kept on this phone. Try again when the network is back, or do it later: you will not have to enter anything again.",
      retry: "Try again",
      later: "Later",
      longRetry: "Try saving all three changes again",
      longLater: "Not now, remind me later",
      undoMessage: "Ravi Kumar marked paid, {amount}",
      undo: "Undo",
      sendReceipt: "Send receipt",
      longUndo: "Undo this payment",
      longSend: "Send the receipt on WhatsApp",
    },
  },
  hi: {
    headline: "फ़ीस समय पर, बिना माँगे।",
    pending: "अभी आना बाकी",
    sentence: "23 में से 9 छात्रों से",
    caption: "2 दिन पहले याद दिलाया। भुगतान पेज एक बार खोला गया।",
    label: "रसीद संख्या 215",
    button: {
      remind: "याद दिलाएँ",
      markPaid: "जमा दर्ज करें",
      share: "भुगतान लिंक भेजें",
      long: "सभी 5 अभिभावकों को इस महीने की फ़ीस के लिए WhatsApp पर याद दिलाएँ",
      busy: "WhatsApp खुल रहा है…",
      disabledReason: "पहले अभिभावक का फ़ोन नंबर जोड़ें।",
      roundLabel: "रवि के अभिभावक को WhatsApp पर याद दिलाएँ",
      next: "आगे: छात्र जोड़ें",
    },
    tag: {
      overdue: "7 दिन देर",
      due: "बाकी 12 Oct",
      partPaid: "कुछ जमा",
      paid: "जमा",
      long: "37 दिन देर, दो बार याद दिलाया",
    },
    stamp: {
      paid: "जमा",
      sent: "भेजा",
      allPaid: "सब जमा",
      paidLabel: "08 Oct 2026 को जमा की मुहर",
      sentLabel: "भेजने की मुहर, 5 में से 1",
      allPaidLabel: "सब जमा की मुहर, अक्टूबर 2026",
      count: "5 में से 1",
      month: "Oct 2026",
    },
    row: {
      name: "रवि कुमार",
      name2: "अनन्या शर्मा",
      name3: "फ़रहान शेख़",
      longName: "वेंकटसुब्रह्मण्यलक्ष्मीनरसिंहराव चिंतलपाटि",
      metaOverdue: "7 दिन देर",
      metaDue: "12 तारीख को बाकी",
      metaPaid: "08 Oct 2026 को UPI से जमा",
      longMeta: "37 दिन देर, दो बार याद दिलाया, भुगतान पेज एक बार खोला गया",
      openLabel: "खोलें",
    },
    field: {
      label: "आपकी UPI ID",
      longLabel: "वह UPI ID जिस पर अभिभावक इस महीने की ट्यूशन फ़ीस भेजें",
      placeholder: "name@bank",
      value: "meena.tuitions@okhdfc",
      partial: "meena.tui",
      wrong: "meena.tuitions",
      correctLabel: "सही",
      correctMessage: "यह सही UPI ID लगती है।",
      errorLabel: "ठीक करना है",
      errorMessage: "इसमें @ के बाद का हिस्सा नहीं है। UPI ID ऐसी दिखती है: name@bank",
      errorShort: "@ के बाद का हिस्सा जोड़ें: name@bank",
      helper: "अभिभावक सीधे इसी ID पर भुगतान करते हैं।",
    },
    tabs: {
      listLabel: "फ़ीस की स्थिति",
      overdue: "देर से",
      due: "बाकी",
      paid: "जमा",
      longOverdue: "इस महीने देर से",
      longDue: "इस हफ़्ते बाकी",
      longPaid: "जमा और पुष्ट",
    },
    sheet: {
      title: "जमा दर्ज करें",
      close: "रद्द करें",
      contextLabel: "कक्षा 10 गणित · अक्टूबर",
      contextTitle: "रवि कुमार",
      body: "रसीद संख्या 215 आपके लिए बन गई है। अब इसे WhatsApp पर भेजें।",
      open: "शीट खोलें",
    },
    segmented: {
      paidBy: "भुगतान का तरीका",
      upi: "UPI",
      cash: "नकद",
      tone: "लहजा",
      polite: "विनम्र",
      politeDetail: "पहली बार हल्की याद",
      firm: "सख़्त",
      firmDetail: "जब बहुत देर हो चुकी हो",
      when: "कब",
      today: "आज",
      yesterday: "कल",
      pickDate: "तारीख चुनें",
      language: "भाषा",
      english: "अंग्रेज़ी",
      hindi: "हिन्दी",
      kannada: "कन्नड़",
      telugu: "तेलुगु",
      longLabel: "चुनें कि इस महीने की फ़ीस की याद बैच के हर अभिभावक को किस लहजे में भेजी जाए",
      longA: "इस हफ़्ते विनम्रता से पहली याद",
      longB: "सख़्ती से आख़िरी याद",
    },
    switch: {
      name: "अपने-आप याद दिलाना",
      on: "चालू",
      off: "बंद",
      longOn: "भेज रहे हैं",
      longOff: "रोका गया",
      visibleLabel: "अभिभावकों को मासिक रिपोर्ट",
    },
    strip: {
      paid: "{n} जमा",
      due: "{n} बाकी, खाली",
      overdue: "{n} देर से, ऊँचा",
      label: "{t} छात्र: {p} जमा, {d} बाकी, {o} देर से",
      longPaid: "{n} इस महीने जमा और पुष्ट",
      longDue: "{n} इस हफ़्ते बाकी, खाली",
      longOverdue: "{n} एक हफ़्ते से ज़्यादा देर, ऊँचा",
    },
    nav: {
      label: "मुख्य",
      home: "होम",
      students: "छात्र",
      attendance: "हाज़िरी",
      more: "और",
      longStudents: "छात्र और बैच",
      longAttendance: "हाज़िरी का रजिस्टर",
    },
    banner: {
      offlineTitle: "आप ऑफ़लाइन हैं",
      offlineDetail: "3 बदलाव इस फ़ोन पर सुरक्षित हैं। नेटवर्क लौटते ही वे सिंक हो जाएँगे।",
      errorTitle: "अभी सेव नहीं हो सका",
      errorDetail: "नेटवर्क चला गया। कुछ भी खोया नहीं है। आपके बदलाव इस फ़ोन पर सुरक्षित हैं।",
      longErrorDetail: "नेटवर्क चला गया। कुछ भी खोया नहीं है। आपके बदलाव इस फ़ोन पर सुरक्षित हैं। नेटवर्क लौटने पर फिर कोशिश करें, या बाद में करें: आपको कुछ भी दोबारा भरना नहीं पड़ेगा।",
      retry: "फिर कोशिश करें",
      later: "बाद में",
      longRetry: "तीनों बदलाव फिर से सेव करने की कोशिश करें",
      longLater: "अभी नहीं, बाद में याद दिलाएँ",
      undoMessage: "रवि कुमार का {amount} जमा दर्ज हुआ",
      undo: "वापस लें",
      sendReceipt: "रसीद भेजें",
      longUndo: "यह भुगतान वापस लें",
      longSend: "रसीद WhatsApp पर भेजें",
    },
  },
  kn: {
    headline: "ಶುಲ್ಕ ಸಮಯಕ್ಕೆ ಸರಿಯಾಗಿ.",
    pending: "ಇನ್ನೂ ಬರಬೇಕಾದದ್ದು",
    sentence: "23 ರಲ್ಲಿ 9 ವಿದ್ಯಾರ್ಥಿಗಳಿಂದ",
    caption: "2 ದಿನಗಳ ಹಿಂದೆ ನೆನಪಿಸಲಾಗಿದೆ. ಪಾವತಿ ಪುಟವನ್ನು ಒಮ್ಮೆ ತೆರೆಯಲಾಗಿದೆ.",
    label: "ರಸೀದಿ ಸಂಖ್ಯೆ 215",
    button: {
      remind: "ನೆನಪಿಸಿ",
      markPaid: "ಪಾವತಿ ದಾಖಲಿಸಿ",
      share: "ಪಾವತಿ ಲಿಂಕ್ ಹಂಚಿಕೊಳ್ಳಿ",
      long: "ಈ ತಿಂಗಳ ಶುಲ್ಕದ ಬಗ್ಗೆ ಎಲ್ಲಾ 5 ಪೋಷಕರಿಗೆ WhatsApp ನಲ್ಲಿ ನೆನಪಿಸಿ",
      busy: "WhatsApp ತೆರೆಯುತ್ತಿದೆ…",
      disabledReason: "ಮೊದಲು ಪೋಷಕರ ಫೋನ್ ಸಂಖ್ಯೆ ಸೇರಿಸಿ.",
      roundLabel: "ರವಿಯ ಪೋಷಕರಿಗೆ WhatsApp ನಲ್ಲಿ ನೆನಪಿಸಿ",
      next: "ಮುಂದೆ: ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ಸೇರಿಸಿ",
    },
    tag: {
      overdue: "7 ದಿನ ತಡ",
      due: "ಬಾಕಿ 12 Oct",
      partPaid: "ಭಾಗಶಃ ಪಾವತಿ",
      paid: "ಪಾವತಿಯಾಗಿದೆ",
      long: "37 ದಿನ ತಡ, ಎರಡು ಬಾರಿ ನೆನಪಿಸಲಾಗಿದೆ",
    },
    stamp: {
      paid: "ಪಾವತಿ",
      sent: "ಕಳಿಸಿದೆ",
      allPaid: "ಎಲ್ಲಾ ಪಾವತಿ",
      paidLabel: "08 Oct 2026 ರಂದು ಪಾವತಿ ಮುದ್ರೆ",
      sentLabel: "ಕಳುಹಿಸಿದ ಮುದ್ರೆ, 5 ರಲ್ಲಿ 1",
      allPaidLabel: "ಎಲ್ಲಾ ಪಾವತಿ ಮುದ್ರೆ, ಅಕ್ಟೋಬರ್ 2026",
      count: "5 ರಲ್ಲಿ 1",
      month: "Oct 2026",
    },
    row: {
      name: "ರವಿ ಕುಮಾರ್",
      name2: "ಅನನ್ಯಾ ಶರ್ಮಾ",
      name3: "ಫರ್ಹಾನ್ ಶೇಖ್",
      longName: "ವೆಂಕಟಸುಬ್ರಹ್ಮಣ್ಯಲಕ್ಷ್ಮೀನರಸಿಂಹರಾವ್ ಚಿಂತಲಪಾಟಿ",
      metaOverdue: "7 ದಿನ ತಡ",
      metaDue: "12ನೇ ತಾರೀಖು ಬಾಕಿ",
      metaPaid: "08 Oct 2026 ರಂದು UPI ಮೂಲಕ ಪಾವತಿ",
      longMeta: "37 ದಿನ ತಡ, ಎರಡು ಬಾರಿ ನೆನಪಿಸಲಾಗಿದೆ, ಪಾವತಿ ಪುಟವನ್ನು ಒಮ್ಮೆ ತೆರೆಯಲಾಗಿದೆ",
      openLabel: "ತೆರೆಯಿರಿ",
    },
    field: {
      label: "ನಿಮ್ಮ UPI ID",
      longLabel: "ಪೋಷಕರು ಈ ತಿಂಗಳ ಟ್ಯೂಷನ್ ಶುಲ್ಕವನ್ನು ಕಳುಹಿಸಬೇಕಾದ UPI ID",
      placeholder: "name@bank",
      value: "meena.tuitions@okhdfc",
      partial: "meena.tui",
      wrong: "meena.tuitions",
      correctLabel: "ಸರಿ",
      correctMessage: "ಇದು ಸರಿಯಾದ UPI ID ಯಂತೆ ಕಾಣುತ್ತದೆ.",
      errorLabel: "ಸರಿಪಡಿಸಬೇಕು",
      errorMessage: "@ ನಂತರದ ಭಾಗ ಇಲ್ಲ. UPI ID ಹೀಗಿರುತ್ತದೆ: name@bank",
      errorShort: "@ ನಂತರದ ಭಾಗ ಸೇರಿಸಿ: name@bank",
      helper: "ಪೋಷಕರು ನೇರವಾಗಿ ಈ ID ಗೆ ಪಾವತಿಸುತ್ತಾರೆ.",
    },
    tabs: {
      listLabel: "ಶುಲ್ಕದ ಸ್ಥಿತಿ",
      overdue: "ತಡ",
      due: "ಬಾಕಿ",
      paid: "ಪಾವತಿ",
      longOverdue: "ಈ ತಿಂಗಳು ತಡವಾಗಿದೆ",
      longDue: "ಈ ವಾರ ಬಾಕಿ",
      longPaid: "ಪಾವತಿಸಿ ದೃಢೀಕರಿಸಲಾಗಿದೆ",
    },
    sheet: {
      title: "ಪಾವತಿ ದಾಖಲಿಸಿ",
      close: "ರದ್ದುಮಾಡಿ",
      contextLabel: "10ನೇ ತರಗತಿ ಗಣಿತ · ಅಕ್ಟೋಬರ್",
      contextTitle: "ರವಿ ಕುಮಾರ್",
      body: "ರಸೀದಿ ಸಂಖ್ಯೆ 215 ನಿಮಗಾಗಿ ಸಿದ್ಧವಾಗಿದೆ. ಈಗ ಅದನ್ನು WhatsApp ನಲ್ಲಿ ಕಳುಹಿಸಿ.",
      open: "ಶೀಟ್ ತೆರೆಯಿರಿ",
    },
    segmented: {
      paidBy: "ಪಾವತಿ ವಿಧಾನ",
      upi: "UPI",
      cash: "ನಗದು",
      tone: "ಧಾಟಿ",
      polite: "ಸೌಮ್ಯ",
      politeDetail: "ಮೊದಲ ಸೌಮ್ಯ ನೆನಪು",
      firm: "ಕಟ್ಟುನಿಟ್ಟು",
      firmDetail: "ತುಂಬಾ ತಡವಾದಾಗ",
      when: "ಯಾವಾಗ",
      today: "ಇಂದು",
      yesterday: "ನಿನ್ನೆ",
      pickDate: "ದಿನಾಂಕ ಆರಿಸಿ",
      language: "ಭಾಷೆ",
      english: "ಇಂಗ್ಲಿಷ್",
      hindi: "ಹಿಂದಿ",
      kannada: "ಕನ್ನಡ",
      telugu: "ತೆಲುಗು",
      longLabel: "ಈ ತಿಂಗಳ ಶುಲ್ಕದ ನೆನಪನ್ನು ಬ್ಯಾಚ್‌ನ ಪ್ರತಿ ಪೋಷಕರಿಗೆ ಯಾವ ಧಾಟಿಯಲ್ಲಿ ಕಳುಹಿಸಬೇಕು ಎಂದು ಆರಿಸಿ",
      longA: "ಈ ವಾರ ಸೌಮ್ಯವಾಗಿ ಮೊದಲ ನೆನಪು",
      longB: "ಕಟ್ಟುನಿಟ್ಟಾಗಿ ಕೊನೆಯ ನೆನಪು",
    },
    switch: {
      name: "ಸ್ವಯಂಚಾಲಿತ ನೆನಪು",
      on: "ಆನ್",
      off: "ಆಫ್",
      longOn: "ಕಳುಹಿಸುತ್ತಿದೆ",
      longOff: "ನಿಲ್ಲಿಸಿದೆ",
      visibleLabel: "ಪೋಷಕರಿಗೆ ಮಾಸಿಕ ವರದಿ",
    },
    strip: {
      paid: "{n} ಪಾವತಿ",
      due: "{n} ಬಾಕಿ, ಖಾಲಿ",
      overdue: "{n} ತಡ, ಎತ್ತರ",
      label: "{t} ವಿದ್ಯಾರ್ಥಿಗಳು: {p} ಪಾವತಿ, {d} ಬಾಕಿ, {o} ತಡ",
      longPaid: "{n} ಈ ತಿಂಗಳು ಪಾವತಿಸಿ ದೃಢೀಕರಿಸಲಾಗಿದೆ",
      longDue: "{n} ಈ ವಾರ ಬಾಕಿ, ಖಾಲಿ",
      longOverdue: "{n} ಒಂದು ವಾರಕ್ಕಿಂತ ಹೆಚ್ಚು ತಡ, ಎತ್ತರ",
    },
    nav: {
      label: "ಮುಖ್ಯ",
      home: "ಮುಖಪುಟ",
      students: "ವಿದ್ಯಾರ್ಥಿಗಳು",
      attendance: "ಹಾಜರಾತಿ",
      more: "ಇನ್ನಷ್ಟು",
      longStudents: "ವಿದ್ಯಾರ್ಥಿಗಳು ಮತ್ತು ಬ್ಯಾಚ್‌ಗಳು",
      longAttendance: "ಹಾಜರಾತಿ ಪುಸ್ತಕ",
    },
    banner: {
      offlineTitle: "ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ",
      offlineDetail: "3 ಬದಲಾವಣೆಗಳು ಈ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿದಿವೆ. ನೆಟ್‌ವರ್ಕ್ ಮರಳಿದಾಗ ಅವು ಸಿಂಕ್ ಆಗುತ್ತವೆ.",
      errorTitle: "ಈಗ ಉಳಿಸಲು ಆಗಲಿಲ್ಲ",
      errorDetail: "ನೆಟ್‌ವರ್ಕ್ ಕಡಿತವಾಯಿತು. ಏನೂ ಕಳೆದುಹೋಗಿಲ್ಲ. ನಿಮ್ಮ ಬದಲಾವಣೆಗಳು ಈ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿದಿವೆ.",
      longErrorDetail: "ನೆಟ್‌ವರ್ಕ್ ಕಡಿತವಾಯಿತು. ಏನೂ ಕಳೆದುಹೋಗಿಲ್ಲ. ನಿಮ್ಮ ಬದಲಾವಣೆಗಳು ಈ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿದಿವೆ. ನೆಟ್‌ವರ್ಕ್ ಮರಳಿದಾಗ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ, ಅಥವಾ ನಂತರ ಮಾಡಿ: ನೀವು ಏನನ್ನೂ ಮತ್ತೆ ತುಂಬಬೇಕಾಗಿಲ್ಲ.",
      retry: "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
      later: "ನಂತರ",
      longRetry: "ಮೂರೂ ಬದಲಾವಣೆಗಳನ್ನು ಮತ್ತೆ ಉಳಿಸಲು ಪ್ರಯತ್ನಿಸಿ",
      longLater: "ಈಗ ಬೇಡ, ನಂತರ ನೆನಪಿಸಿ",
      undoMessage: "ರವಿ ಕುಮಾರ್ {amount} ಪಾವತಿ ದಾಖಲಾಗಿದೆ",
      undo: "ರದ್ದುಮಾಡಿ",
      sendReceipt: "ರಸೀದಿ ಕಳುಹಿಸಿ",
      longUndo: "ಈ ಪಾವತಿಯನ್ನು ರದ್ದುಮಾಡಿ",
      longSend: "ರಸೀದಿಯನ್ನು WhatsApp ನಲ್ಲಿ ಕಳುಹಿಸಿ",
    },
  },
  te: {
    headline: "ఫీజు సమయానికి.",
    pending: "ఇంకా రావలసినది",
    sentence: "23 మందిలో 9 మంది నుండి",
    caption: "2 రోజుల క్రితం గుర్తు చేశారు. చెల్లింపు పేజీ ఒకసారి తెరిచారు.",
    label: "రసీదు సంఖ్య 215",
    button: {
      remind: "గుర్తు చేయండి",
      markPaid: "చెల్లింపు నమోదు చేయండి",
      share: "చెల్లింపు లింక్ పంపండి",
      long: "ఈ నెల ఫీజు గురించి 5 మంది తల్లిదండ్రులందరికీ WhatsApp లో గుర్తు చేయండి",
      busy: "WhatsApp తెరుస్తోంది…",
      disabledReason: "ముందు తల్లిదండ్రుల ఫోన్ నంబర్ జోడించండి.",
      roundLabel: "రవి తల్లిదండ్రులకు WhatsApp లో గుర్తు చేయండి",
      next: "తర్వాత: విద్యార్థులను జోడించండి",
    },
    tag: {
      overdue: "7 రోజులు ఆలస్యం",
      due: "బాకీ 12 Oct",
      partPaid: "కొంత చెల్లించారు",
      paid: "చెల్లించారు",
      long: "37 రోజులు ఆలస్యం, రెండుసార్లు గుర్తు చేశారు",
    },
    stamp: {
      paid: "చెల్లింపు",
      sent: "పంపారు",
      allPaid: "అన్నీ చెల్లింపు",
      paidLabel: "08 Oct 2026 న చెల్లింపు ముద్ర",
      sentLabel: "పంపిన ముద్ర, 5 లో 1",
      allPaidLabel: "అన్నీ చెల్లింపు ముద్ర, అక్టోబర్ 2026",
      count: "5 లో 1",
      month: "Oct 2026",
    },
    row: {
      name: "రవి కుమార్",
      name2: "అనన్య శర్మ",
      name3: "ఫర్హాన్ షేక్",
      longName: "వెంకటసుబ్రహ్మణ్యలక్ష్మీనరసింహరావు చింతలపాటి",
      metaOverdue: "7 రోజులు ఆలస్యం",
      metaDue: "12వ తేదీన బాకీ",
      metaPaid: "08 Oct 2026 న UPI ద్వారా చెల్లించారు",
      longMeta: "37 రోజులు ఆలస్యం, రెండుసార్లు గుర్తు చేశారు, చెల్లింపు పేజీ ఒకసారి తెరిచారు",
      openLabel: "తెరవండి",
    },
    field: {
      label: "మీ UPI ID",
      longLabel: "తల్లిదండ్రులు ఈ నెల ట్యూషన్ ఫీజు పంపవలసిన UPI ID",
      placeholder: "name@bank",
      value: "meena.tuitions@okhdfc",
      partial: "meena.tui",
      wrong: "meena.tuitions",
      correctLabel: "సరైనది",
      correctMessage: "ఇది సరైన UPI ID లా ఉంది.",
      errorLabel: "సరిచేయాలి",
      errorMessage: "@ తర్వాత భాగం లేదు. UPI ID ఇలా ఉంటుంది: name@bank",
      errorShort: "@ తర్వాత భాగం జోడించండి: name@bank",
      helper: "తల్లిదండ్రులు నేరుగా ఈ ID కి చెల్లిస్తారు.",
    },
    tabs: {
      listLabel: "ఫీజు స్థితి",
      overdue: "ఆలస్యం",
      due: "బాకీ",
      paid: "చెల్లింపు",
      longOverdue: "ఈ నెల ఆలస్యం",
      longDue: "ఈ వారం బాకీ",
      longPaid: "చెల్లించి నిర్ధారించారు",
    },
    sheet: {
      title: "చెల్లింపు నమోదు చేయండి",
      close: "రద్దు చేయండి",
      contextLabel: "10వ తరగతి గణితం · అక్టోబర్",
      contextTitle: "రవి కుమార్",
      body: "రసీదు సంఖ్య 215 మీ కోసం సిద్ధమైంది. ఇప్పుడు దాన్ని WhatsApp లో పంపండి.",
      open: "షీట్ తెరవండి",
    },
    segmented: {
      paidBy: "చెల్లింపు విధానం",
      upi: "UPI",
      cash: "నగదు",
      tone: "ధోరణి",
      polite: "మర్యాదగా",
      politeDetail: "మొదటి సున్నితమైన గుర్తు",
      firm: "గట్టిగా",
      firmDetail: "చాలా ఆలస్యమైనప్పుడు",
      when: "ఎప్పుడు",
      today: "ఈరోజు",
      yesterday: "నిన్న",
      pickDate: "తేదీ ఎంచుకోండి",
      language: "భాష",
      english: "ఇంగ్లీష్",
      hindi: "హిందీ",
      kannada: "కన్నడ",
      telugu: "తెలుగు",
      longLabel: "ఈ నెల ఫీజు గుర్తును బ్యాచ్‌లోని ప్రతి తల్లిదండ్రులకు ఏ ధోరణిలో పంపాలో ఎంచుకోండి",
      longA: "ఈ వారం మర్యాదగా మొదటి గుర్తు",
      longB: "గట్టిగా చివరి గుర్తు",
    },
    switch: {
      name: "ఆటోమేటిక్ గుర్తు",
      on: "ఆన్",
      off: "ఆఫ్",
      longOn: "పంపుతోంది",
      longOff: "ఆపివేశారు",
      visibleLabel: "తల్లిదండ్రులకు నెలవారీ నివేదిక",
    },
    strip: {
      paid: "{n} చెల్లింపు",
      due: "{n} బాకీ, ఖాళీ",
      overdue: "{n} ఆలస్యం, పొడవు",
      label: "{t} మంది విద్యార్థులు: {p} చెల్లింపు, {d} బాకీ, {o} ఆలస్యం",
      longPaid: "{n} ఈ నెల చెల్లించి నిర్ధారించారు",
      longDue: "{n} ఈ వారం బాకీ, ఖాళీ",
      longOverdue: "{n} వారం కంటే ఎక్కువ ఆలస్యం, పొడవు",
    },
    nav: {
      label: "ముఖ్య",
      home: "హోమ్",
      students: "విద్యార్థులు",
      attendance: "హాజరు",
      more: "మరిన్ని",
      longStudents: "విద్యార్థులు మరియు బ్యాచ్‌లు",
      longAttendance: "హాజరు పుస్తకం",
    },
    banner: {
      offlineTitle: "మీరు ఆఫ్‌లైన్‌లో ఉన్నారు",
      offlineDetail: "3 మార్పులు ఈ ఫోన్‌లో భద్రంగా ఉన్నాయి. నెట్‌వర్క్ తిరిగి వచ్చినప్పుడు అవి సింక్ అవుతాయి.",
      errorTitle: "ఇప్పుడు సేవ్ కాలేదు",
      errorDetail: "నెట్‌వర్క్ పోయింది. ఏదీ పోలేదు. మీ మార్పులు ఈ ఫోన్‌లో భద్రంగా ఉన్నాయి.",
      longErrorDetail: "నెట్‌వర్క్ పోయింది. ఏదీ పోలేదు. మీ మార్పులు ఈ ఫోన్‌లో భద్రంగా ఉన్నాయి. నెట్‌వర్క్ తిరిగి వచ్చినప్పుడు మళ్లీ ప్రయత్నించండి, లేదా తర్వాత చేయండి: మీరు ఏదీ మళ్లీ నింపాల్సిన అవసరం లేదు.",
      retry: "మళ్లీ ప్రయత్నించండి",
      later: "తర్వాత",
      longRetry: "మూడు మార్పులనూ మళ్లీ సేవ్ చేయడానికి ప్రయత్నించండి",
      longLater: "ఇప్పుడు వద్దు, తర్వాత గుర్తు చేయండి",
      undoMessage: "రవి కుమార్ {amount} చెల్లింపు నమోదైంది",
      undo: "రద్దు చేయండి",
      sendReceipt: "రసీదు పంపండి",
      longUndo: "ఈ చెల్లింపును రద్దు చేయండి",
      longSend: "రసీదును WhatsApp లో పంపండి",
    },
  },
};

/** The page's own words: headings and the captions over each example. English only; it is an internal page. */
export const copy = {
  title: "Design system",
  intro: "Every token, type role and component, in every state, in four scripts. Internal page: it is left out of the production build.",
  tokens: {
    title: "Colour",
    note: "Names and values are read from the token file when the site is built.",
  },
  type: {
    title: "Type",
    headline: "Headline",
    amount: "Headline amount",
    bodyLg: "Reading text, large",
    body: "Reading text",
    bodySm: "Reading text, small",
    caption: "Caption",
    label: "Label",
    control: "Button text",
    controlSm: "Tab text",
    name: "Row name",
    amountRow: "Row amount",
  },
  rupee: {
    title: "The rupee sign",
    note: "Check on a real phone that the sign sits on the same line as the digits and looks like the same weight.",
    headline: "Headline size: sign and digits both Bricolage Grotesque",
    fit: "Too wide for the screen at this size: it gets smaller, on one line, never broken",
    fitNarrow: "The same amounts in half the width",
    reading: "Reading size: sign and digits both Bricolage Grotesque",
    row: "Row size: digits DM Mono, sign from Bricolage Grotesque",
    rowEnlarged: "The same two faces, enlarged, so the join is easy to judge",
    rowSignAlone: "Sign alone, then digits alone",
    alternative: "For comparison only: all Bricolage Grotesque with even-width figures. Not what rows use.",
    inScript: "Inside running text",
    inRow: "In a ledger row",
    digits: "0123456789",
  },
  formats: {
    title: "Formats",
    note: "formatRupees, formatDate and formatPhone give the same text in all four languages: digits 0 to 9, Indian grouping, English months.",
    rupees: "formatRupees",
    date: "formatDate",
    phone: "formatPhone",
  },
  states: {
    rest: "Rest",
    pressed: "Pressed",
    focus: "Keyboard focus",
    busy: "Working",
    disabled: "Not available",
    long: "Long label",
    link: "As a link",
    icons: "With an icon before and after",
    onCloth: "On cloth",
    onDark: "On the dark ground",
    tapToBusy: "Tap to see it work",
  },
  button: {
    title: "Button",
    send: "Send: sends a message or pays",
    record: "Record: saves",
    outline: "Outline: secondary",
    round: "Round, for the row action",
    backToTop: "Back to top",
  },
  field: {
    title: "Field",
    empty: "Empty",
    typing: "Typing",
    correct: "Correct",
    error: "Needs fixing",
    helper: "With helper text",
    long: "Long label and message",
    live: "Try it",
  },
  slip: {
    title: "Slip",
    standard: "Standard",
    joined: "Joined, for sitting under tabs",
    body: "A slip is a card: slip colour, a 2px border, square corners and a hard shadow.",
    joinedBody: "No shadow. The selected tab sits on its top edge with no line between.",
  },
  row: {
    title: "Row",
    tones: "Overdue, due and paid",
    link: "Row as a link with a separate action",
    long: "Long name and meta",
    plain: "Without amount or trailing item",
  },
  tag: {
    title: "Status tag",
    four: "The four statuses",
    long: "Long tag",
  },
  stamp: {
    title: "Stamp",
    sm: "Small, for a row",
    md: "Medium, for a receipt",
    lg: "Large",
    animated: "Landing after a payment",
    replay: "Play again",
  },
  tabs: {
    title: "Tabs",
    standard: "Three tabs joined to a slip",
    long: "Long labels",
    panel: "The chosen tab is taller and joins the slip below.",
  },
  sheet: {
    title: "Sheet",
    open: "Open it",
    still: "How it looks, without opening it",
    amountLabel: "Amount received",
    amountValue: "1,200",
    tall: "Open with tall content",
    focused: "Open with the cursor already in the field",
    line: "A line of content to make the sheet taller than the screen.",
  },
  segmented: {
    title: "Segmented",
    note: "A radio group. Tap a choice, or use the arrow keys.",
    two: "Two choices",
    twoLine: "Two lines in each choice",
    three: "Three choices",
    four: "Four choices: two rows of two on a phone",
    long: "Long label and long choices",
    focusChosen: "Keyboard focus on the chosen one: the ring is inside, in yellow",
    focusOther: "Keyboard focus on another one: the ring is inside, in blue",
    live: "Try it: the screen holds the choice",
    chosen: "Chosen:",
  },
  switch: {
    title: "Switch",
    note: "Every switch here works: tap it. On and off differ by where the knob sits and the word on it, not only by the green.",
    on: "On",
    off: "Off",
    labelled: "Named by the words beside it",
    focus: "Keyboard focus",
    long: "A longer word: the switch grows wider, and is the same width on and off",
  },
  strip: {
    title: "Student strip",
    note: "One block per student. Paid is short and filled, due is short and hollow, overdue is tall. The words underneath always say the same.",
    one: "1 student",
    typical: "23 students, as on the home screen",
    many: "60 students: three rows of 20",
    long: "Long legend",
    none: "No students: the strip draws nothing. The box below is empty on purpose.",
    onSlip: "On a slip",
  },
  nav: {
    title: "Bottom nav",
    note: "Shown in the page here. On a real screen it is pinned to the bottom. The current item has the red bar on top.",
    standard: "Four items, a different current one in each language",
    long: "Long labels: they wrap and the bar grows",
    focus: "Keyboard focus: the ring is inside the item",
    longSuffix: "(long)",
  },
  banner: {
    title: "Banner",
    note: "Three kinds. Each says what happened in plain words; the error one also says what is safe. With a screen reader, all of them may be read out when this page loads: that happens on this page only.",
    offline: "Offline: a full-width strip, no actions",
    error: "Error: red outline and shadow, a black and an outlined button",
    errorOne: "Error with one action",
    errorNone: "Error with no action",
    undo: "Undo: two actions, the second a link with an icon",
    long: "Long text and long action labels",
    live: "Try it: each tap is counted",
    taps: "Taps:",
    pressed: "Flat buttons pressed: a 2px move, no shadow",
    focus: "Keyboard focus: yellow on the dark banner, blue on the paper one",
  },
};
