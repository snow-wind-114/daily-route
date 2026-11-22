const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISO(now = new Date()) {
  return toISODate(now);
}

export function isISODate(value) {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const date = parseISODate(value);
  return toISODate(date) === value;
}

export function parseISODate(value) {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function addDays(isoDate, amount) {
  const date = parseISODate(isoDate);
  if (!date || !Number.isInteger(amount)) {
    throw new Error("无效日期");
  }

  date.setDate(date.getDate() + amount);
  return toISODate(date);
}

export function addMonthsClamped(isoDate, amount) {
  const date = parseISODate(isoDate);
  if (!date || !Number.isInteger(amount)) {
    throw new Error("无效日期");
  }

  const originalDay = date.getDate();
  const targetMonth = new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    1,
    12,
  );
  const daysInTargetMonth = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0,
    12,
  ).getDate();

  targetMonth.setDate(Math.min(originalDay, daysInTargetMonth));
  return toISODate(targetMonth);
}

export function getScheduleWindow(startDate = todayISO()) {
  const year = Number(startDate.slice(0, 4));
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

export function isWithinWindow(date, startDate, endDate) {
  return isISODate(date) && date >= startDate && date <= endDate;
}

export function diffCalendarDays(fromDate, toDate) {
  const from = parseISODate(fromDate);
  const to = parseISODate(toDate);
  if (!from || !to) {
    throw new Error("无效日期");
  }

  const fromUtc = Date.UTC(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
  );
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function startOfMonth(isoDate) {
  const date = parseISODate(isoDate);
  if (!date) {
    throw new Error("无效日期");
  }

  return toISODate(new Date(date.getFullYear(), date.getMonth(), 1, 12));
}

export function endOfMonth(isoDate) {
  const date = parseISODate(isoDate);
  if (!date) {
    throw new Error("无效日期");
  }

  return toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12));
}

export function addMonthsToMonth(isoDate, amount) {
  return addMonthsClamped(startOfMonth(isoDate), amount);
}

export function mondayBasedWeekday(isoDate) {
  const date = parseISODate(isoDate);
  if (!date) {
    throw new Error("无效日期");
  }

  return (date.getDay() + 6) % 7;
}

export function formatDayTitle(isoDate) {
  const date = parseISODate(isoDate);
  if (!date) {
    return "";
  }

  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
}

export function formatMonthTitle(isoDate) {
  const date = parseISODate(isoDate);
  return date ? `${date.getFullYear()}年${date.getMonth() + 1}月` : "";
}

export function formatShortDate(isoDate) {
  const date = parseISODate(isoDate);
  return date ? `${date.getMonth() + 1}月${date.getDate()}日` : "";
}

export function formatTimeRange(startTime, endTime) {
  return `${startTime}–${endTime}`;
}

export function timeToMinutes(value) {
  if (!TIME_PATTERN.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(value) {
  const minutes = Math.min(1439, Math.max(0, Math.round(value)));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function currentTimeParts(now = new Date()) {
  return {
    time: `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`,
    minutes: now.getHours() * 60 + now.getMinutes(),
  };
}

export function defaultTimes(selectedDate, now = new Date()) {
  if (selectedDate !== todayISO(now)) {
    return { startTime: "09:00", endTime: "10:00" };
  }

  const startMinutes = now.getHours() * 60 + now.getMinutes();
  const roundedStart = Math.min(
    22 * 60,
    Math.ceil((startMinutes + 1) / 30) * 30,
  );

  return {
    startTime: minutesToTime(roundedStart),
    endTime: minutesToTime(Math.min(23 * 60 + 59, roundedStart + 60)),
  };
}

