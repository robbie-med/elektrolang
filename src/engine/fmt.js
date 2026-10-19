// Number formatting shared by the text packs.
export const n1 = (x) => {
  if (x == null || Number.isNaN(x)) return "?";
  const r = Math.round(x * 10) / 10;
  return (Object.is(r, -0) ? 0 : r).toString().replace("-", "−");
};
export const n0 = (x) => (x == null || Number.isNaN(x) ? "?" : Math.round(x).toString().replace("-", "−"));
export const sn = (x) => (x > 0 ? "+" + n1(x) : n1(x));
export const dg = (x) => (Math.round(x) > 0 ? "+" : "") + n0(x) + "°";
export const list = (xs, and = "and") =>
  xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + ` ${and} ` + xs[xs.length - 1];
