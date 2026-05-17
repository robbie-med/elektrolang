export const EKG_D =
  "M 0,95 L 40,95 Q 60,67 80,95 L 118,95 L 124,107 L 132,12 L 140,110 C 145,96 152,95 160,95 L 182,95 Q 202,62 224,95 L 280,95 Q 300,67 320,95 L 358,95 L 364,107 L 372,12 L 380,110 C 385,96 393,95 401,95 L 422,95 Q 442,62 464,95 L 520,95 Q 540,67 560,95 L 598,95 L 604,107 L 612,12 L 620,110 C 625,96 633,95 641,95 L 662,95 Q 682,62 704,95 L 780,95";

export const HL = {
  rr: { x: 108, w: 276, label: "R-R Interval" },
  all: { x: 0, w: 780, label: "Full Rhythm Strip" },
  p: { x: 274, w: 52, label: "P Wave" },
  pr: { x: 274, w: 84, label: "PR Interval" },
  qrs: { x: 350, w: 58, label: "QRS Complex" },
  st: { x: 394, w: 36, label: "ST Segment" },
  t: { x: 414, w: 58, label: "T Wave" },
  qt: { x: 349, w: 122, label: "QT Interval" },
  axis: { x: 0, w: 780, label: "Leads I + aVF" },
};
