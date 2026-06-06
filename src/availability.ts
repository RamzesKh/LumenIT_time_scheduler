export type DayKey =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export type DailyAvailability = {
  start: string;
  end: string;
};

export type WeekAvailability = Record<DayKey, DailyAvailability>;

export type MeetingSlot = {
  day: DayKey;
  start: string;
  end: string;
};

export type Person = {
  id: number;
  name: string;
  availability: WeekAvailability;
};

export const days: DayKey[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const minutesToTime = (minutes: number) => {
  const normalized = Math.max(0, Math.min(24 * 60, minutes));
  const hours = Math.floor(normalized / 60);
  const remainder = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const timeToMinutes = (time: string) => {
  if (!time) {
    return null;
  }

  const [hoursPart, minutesPart] = time.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

export const emptyWeekAvailability = (): WeekAvailability =>
  days.reduce((accumulator, day) => {
    accumulator[day] = { start: "", end: "" };
    return accumulator;
  }, {} as WeekAvailability);

export const createDefaultPeople = (): Person[] =>
  Array.from({ length: 4 }, (_, index) => ({
    id: index + 1,
    name:
      index === 0
        ? "Ramzes"
        : index === 1
          ? "Asim"
          : index === 2
            ? "Shayan"
            : "Mani",
    availability: emptyWeekAvailability(),
  }));

export const findCommonSlots = (people: Person[]): MeetingSlot[] => {
  return days.flatMap((day) => {
    const ranges = people
      .map((person) => {
        const startMinutes = timeToMinutes(person.availability[day].start);
        const endMinutes = timeToMinutes(person.availability[day].end);

        if (
          startMinutes === null ||
          endMinutes === null ||
          endMinutes <= startMinutes
        ) {
          return null;
        }

        return { startMinutes, endMinutes };
      })
      .filter(
        (range): range is { startMinutes: number; endMinutes: number } =>
          range !== null,
      );

    if (ranges.length !== people.length) {
      return [];
    }

    const overlapStart = Math.max(...ranges.map((range) => range.startMinutes));
    const overlapEnd = Math.min(...ranges.map((range) => range.endMinutes));

    if (overlapEnd <= overlapStart) {
      return [];
    }

    return [
      {
        day,
        start: minutesToTime(overlapStart),
        end: minutesToTime(overlapEnd),
      },
    ];
  });
};
