// All text shown on /dev/components. The page is an internal tool, not a user-facing screen, so its
// words live here and not in messages/*.json (spec F2, open question 1). Components hold no strings:
// everything below is passed to them as props.
// The Hindi, Kannada and Telugu strings are drafts for checking how the scripts set. A native speaker
// has not reviewed them; do not copy them into messages/*.json.

export type Lang = "en" | "hi" | "kn" | "te";

export const langs: Lang[] = ["en", "hi", "kn", "te"];
export const indicLangs: Lang[] = ["hi", "kn", "te"];

export const langNames: Record<Lang, string> = {
  en: "English",
  hi: "Hindi",
  kn: "Kannada",
  te: "Telugu",
};

/** Amounts and dates are plain strings here; formatRupees() and formatDate() arrive in F3. */
export const figures = {
  large: "₹1,23,456",
  largeRest: "₹78,900",
  row: "₹1,200",
  rowLarge: "₹1,23,456",
  allDigits: "₹0123456789",
  rupee: "₹",
  date: "08 Oct 2026",
  fee: "₹18,500",
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
    reading: "Reading size: sign and digits both Bricolage Grotesque",
    row: "Row size: digits DM Mono, sign from Bricolage Grotesque",
    rowEnlarged: "The same two faces, enlarged, so the join is easy to judge",
    rowSignAlone: "Sign alone, then digits alone",
    alternative: "For comparison only: all Bricolage Grotesque with even-width figures. Not what rows use.",
    inScript: "Inside running text",
    inRow: "In a ledger row",
    digits: "0123456789",
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
    line: "A line of content to make the sheet taller than the screen.",
  },
};
