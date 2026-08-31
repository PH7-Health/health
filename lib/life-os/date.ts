export function localDate(value = new Date()) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + count);
  return next;
}

export function weekStart(date = localDate()) {
  const day = date.getUTCDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

export function dateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(date);
}
