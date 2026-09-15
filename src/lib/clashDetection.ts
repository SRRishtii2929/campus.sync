import type { ClassEntry, EventEntry, Announcement } from './supabase';

export interface ClashDetail {
  id: string;
  type: 'class_class' | 'class_event' | 'event_event' | 'class_announcement' | 'announcement_announcement' | 'event_announcement';
  activityA: { label: string; date: string; start: string; end: string };
  activityB: { label: string; date: string; start: string; end: string };
  overlapStart: string;
  overlapEnd: string;
  date: string;
  message: string;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function sameDate(dateA: string | null, dateB: string | null): boolean {
  if (!dateA || !dateB) return false;
  return dateA === dateB;
}

export function detectClashes(
  classes: ClassEntry[],
  events: EventEntry[],
  recurringClassDates?: string[],
  announcements?: Announcement[]
): ClashDetail[] {
  const clashes: ClashDetail[] = [];

  // Class vs Class
  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      const a = classes[i];
      const b = classes[j];
      // Check if on same date OR if both are recurring (date is null) on same day of week
      const sameDateCheck = sameDate(a.date, b.date);
      const sameDayRecurring = !a.date && !b.date && a.day_of_week === b.day_of_week;
      if (sameDateCheck || sameDayRecurring) {
        if (rangesOverlap(toMinutes(a.start_time), toMinutes(a.end_time), toMinutes(b.start_time), toMinutes(b.end_time))) {
          const overlapStart = Math.max(toMinutes(a.start_time), toMinutes(b.start_time));
          const overlapEnd = Math.min(toMinutes(a.end_time), toMinutes(b.end_time));
          const dateStr = a.date || b.date || (recurringClassDates ? recurringClassDates[0] : '');
          clashes.push({
            id: `cc-${a.id}-${b.id}`,
            type: 'class_class',
            activityA: { label: a.subject, date: dateStr, start: a.start_time, end: a.end_time },
            activityB: { label: b.subject, date: dateStr, start: b.start_time, end: b.end_time },
            overlapStart: formatTimeFromMinutes(overlapStart),
            overlapEnd: formatTimeFromMinutes(overlapEnd),
            date: dateStr,
            message: `Schedule Clash Detected: ${a.subject} Class overlaps with ${b.subject} Class from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
          });
        }
      }
    }
  }

  // Class vs Event
  for (const cls of classes) {
    for (const evt of events) {
      const classDate = cls.date;
      if (classDate && sameDate(classDate, evt.date)) {
        if (rangesOverlap(toMinutes(cls.start_time), toMinutes(cls.end_time), toMinutes(evt.start_time), toMinutes(evt.end_time))) {
          const overlapStart = Math.max(toMinutes(cls.start_time), toMinutes(evt.start_time));
          const overlapEnd = Math.min(toMinutes(cls.end_time), toMinutes(evt.end_time));
          clashes.push({
            id: `ce-${cls.id}-${evt.id}`,
            type: 'class_event',
            activityA: { label: cls.subject, date: evt.date, start: cls.start_time, end: cls.end_time },
            activityB: { label: evt.title, date: evt.date, start: evt.start_time, end: evt.end_time },
            overlapStart: formatTimeFromMinutes(overlapStart),
            overlapEnd: formatTimeFromMinutes(overlapEnd),
            date: evt.date,
            message: `Schedule Clash Detected: ${cls.subject} Class overlaps with the ${evt.title} from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
          });
        }
      }
    }
  }

  // Class vs Announcement
  if (announcements) {
    for (const cls of classes) {
      for (const ann of announcements) {
        if (!ann.event_time) continue;
        const annDate = ann.event_date || ann.date;
        const annTime = ann.event_time;
        const annEnd = addOneHour(annTime);
        const classDate = cls.date;
        const datesMatch = classDate
          ? sameDate(classDate, annDate)
          : sameDayOfWeek(cls.day_of_week, annDate);
        if (datesMatch) {
          if (rangesOverlap(toMinutes(cls.start_time), toMinutes(cls.end_time), toMinutes(annTime), toMinutes(annEnd))) {
            const overlapStart = Math.max(toMinutes(cls.start_time), toMinutes(annTime));
            const overlapEnd = Math.min(toMinutes(cls.end_time), toMinutes(annEnd));
            clashes.push({
              id: `ca-${cls.id}-${ann.id}`,
              type: 'class_announcement',
              activityA: { label: cls.subject, date: annDate, start: cls.start_time, end: cls.end_time },
              activityB: { label: ann.title, date: annDate, start: annTime, end: annEnd },
              overlapStart: formatTimeFromMinutes(overlapStart),
              overlapEnd: formatTimeFromMinutes(overlapEnd),
              date: annDate,
              message: `Schedule Clash Detected: ${cls.subject} Class overlaps with the ${ann.title} announcement event from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
            });
          }
        }
      }
    }
  }

  // Announcement vs Announcement
  if (announcements) {
    for (let i = 0; i < announcements.length; i++) {
      for (let j = i + 1; j < announcements.length; j++) {
        const a = announcements[i];
        const b = announcements[j];
        if (!a.event_time || !b.event_time) continue;
        const aDate = a.event_date || a.date;
        const bDate = b.event_date || b.date;
        if (sameDate(aDate, bDate)) {
          const aEnd = addOneHour(a.event_time);
          const bEnd = addOneHour(b.event_time);
          if (rangesOverlap(toMinutes(a.event_time), toMinutes(aEnd), toMinutes(b.event_time), toMinutes(bEnd))) {
            const overlapStart = Math.max(toMinutes(a.event_time), toMinutes(b.event_time));
            const overlapEnd = Math.min(toMinutes(aEnd), toMinutes(bEnd));
            clashes.push({
              id: `aa-${a.id}-${b.id}`,
              type: 'announcement_announcement',
              activityA: { label: a.title, date: aDate, start: a.event_time, end: aEnd },
              activityB: { label: b.title, date: bDate, start: b.event_time, end: bEnd },
              overlapStart: formatTimeFromMinutes(overlapStart),
              overlapEnd: formatTimeFromMinutes(overlapEnd),
              date: aDate,
              message: `Schedule Clash Detected: ${a.title} overlaps with ${b.title} from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
            });
          }
        }
      }
    }
  }

  // Event vs Announcement
  if (announcements) {
    for (const evt of events) {
      for (const ann of announcements) {
        if (!ann.event_time) continue;
        const annDate = ann.event_date || ann.date;
        if (sameDate(evt.date, annDate)) {
          const annEnd = addOneHour(ann.event_time);
          if (rangesOverlap(toMinutes(evt.start_time), toMinutes(evt.end_time), toMinutes(ann.event_time), toMinutes(annEnd))) {
            const overlapStart = Math.max(toMinutes(evt.start_time), toMinutes(ann.event_time));
            const overlapEnd = Math.min(toMinutes(evt.end_time), toMinutes(annEnd));
            clashes.push({
              id: `ea-${evt.id}-${ann.id}`,
              type: 'event_announcement',
              activityA: { label: evt.title, date: evt.date, start: evt.start_time, end: evt.end_time },
              activityB: { label: ann.title, date: annDate, start: ann.event_time, end: annEnd },
              overlapStart: formatTimeFromMinutes(overlapStart),
              overlapEnd: formatTimeFromMinutes(overlapEnd),
              date: evt.date,
              message: `Schedule Clash Detected: ${evt.title} overlaps with the ${ann.title} announcement event from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
            });
          }
        }
      }
    }
  }

  // Event vs Event
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (sameDate(a.date, b.date)) {
        if (rangesOverlap(toMinutes(a.start_time), toMinutes(a.end_time), toMinutes(b.start_time), toMinutes(b.end_time))) {
          const overlapStart = Math.max(toMinutes(a.start_time), toMinutes(b.start_time));
          const overlapEnd = Math.min(toMinutes(a.end_time), toMinutes(b.end_time));
          clashes.push({
            id: `ee-${a.id}-${b.id}`,
            type: 'event_event',
            activityA: { label: a.title, date: a.date, start: a.start_time, end: a.end_time },
            activityB: { label: b.title, date: b.date, start: b.start_time, end: b.end_time },
            overlapStart: formatTimeFromMinutes(overlapStart),
            overlapEnd: formatTimeFromMinutes(overlapEnd),
            date: a.date,
            message: `Schedule Clash Detected: ${a.title} overlaps with ${b.title} from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
          });
        }
      }
    }
  }

  return clashes.filter((c) => {
    const clashDate = new Date(c.date + 'T23:59:59');
    return clashDate >= new Date();
  });
}

function sameDayOfWeek(dayOfWeek: string, dateStr: string): boolean {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const date = new Date(dateStr + 'T00:00:00');
  return days[date.getDay()] === dayOfWeek;
}

function addOneHour(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const newH = (h + 1) % 24;
  return `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTimeFromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatTime12(t: string): string {
  return formatTime(t);
}

export function formatDate(d: string): string {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
