import { useMemo, useState, useEffect } from "react";
import {
  createDefaultPeople,
  days,
  findCommonSlots,
  type DayKey,
  type Person,
} from "./availability";

const formatTimeHint = "Use 24-hour format like 09:00 and 17:30";

const STORAGE_KEY = "lumenit.people";

const App = () => {
  const [people, setPeople] = useState<Person[]>(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          return JSON.parse(raw) as Person[];
        }
      }
    } catch (e) {
      // ignore and fall back
    }

    return createDefaultPeople();
  });

  const commonSlots = useMemo(() => findCommonSlots(people), [people]);

  const updatePersonName = (id: number, name: string) => {
    setPeople((currentPeople) =>
      currentPeople.map((person) =>
        person.id === id ? { ...person, name } : person,
      ),
    );
  };

  const updatePersonAvailability = (
    id: number,
    day: DayKey,
    field: "start" | "end",
    value: string,
  ) => {
    setPeople((currentPeople) =>
      currentPeople.map((person) =>
        person.id === id
          ? {
              ...person,
              availability: {
                ...person.availability,
                [day]: {
                  ...person.availability[day],
                  [field]: value,
                },
              },
            }
          : person,
      ),
    );
  };

  const resetSchedule = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      // ignore
    }

    setPeople(createDefaultPeople());
  };

  // persist people whenever they change
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
      }
    } catch (e) {
      // ignore storage errors
    }
  }, [people]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">LumenIT</p>
          <h1>Time Scheduler</h1>
          <p className="lede">
            Enter start and end times for each day. Matching windows show
            possible meeting days.
          </p>
        </div>
        <div className="hero-card">
          <span>Team momentum</span>
          <strong>Small wins — sync the team, keep moving forward.</strong>
        </div>
      </section>

      <section className="board">
        <div className="board-header">
          <div>
            <p className="section-label">Weekly inputs</p>
            <h2>Team availability</h2>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={resetSchedule}
          >
            Reset
          </button>
        </div>

        <div className="people-grid">
          {people.map((person) => (
            <article key={person.id} className="person-card">
              <div className="person-card__header">
                <div>
                  <p className="person-index">Person {person.id}</p>
                  <input
                    aria-label={`Name for person ${person.id}`}
                    className="name-input"
                    type="text"
                    value={person.name}
                    onChange={(event) =>
                      updatePersonName(person.id, event.target.value)
                    }
                    placeholder={`Member ${person.id}`}
                  />
                </div>
                <span className="pill">7 days</span>
              </div>

              <div className="availability-table">
                {days.map((day) => (
                  <div key={day} className="availability-row">
                    <span className="day-label">{day}</span>
                    <input
                      aria-label={`${person.name} start time for ${day}`}
                      type="time"
                      value={person.availability[day].start}
                      onChange={(event) =>
                        updatePersonAvailability(
                          person.id,
                          day,
                          "start",
                          event.target.value,
                        )
                      }
                    />
                    <span className="to-label">to</span>
                    <input
                      aria-label={`${person.name} end time for ${day}`}
                      type="time"
                      value={person.availability[day].end}
                      onChange={(event) =>
                        updatePersonAvailability(
                          person.id,
                          day,
                          "end",
                          event.target.value,
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="results">
        <div className="results-header">
          <div>
            <p className="section-label">Possible meeting spot</p>
            <h2>Shared overlap</h2>
          </div>
          <span className="hint">{formatTimeHint}</span>
        </div>

        {commonSlots.length > 0 ? (
          <div className="results-list">
            {commonSlots.map((slot) => (
              <article key={slot.day} className="result-card success">
                <span className="result-day">{slot.day}</span>
                <strong>
                  {slot.start} - {slot.end}
                </strong>
                <p>The whole team is available during this window.</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="result-card empty">
            <strong>No 4-way overlap yet.</strong>
            <p>
              Fill in all four schedules with matching time ranges to reveal
              meeting days.
            </p>
          </div>
        )}
      </section>
    </main>
  );
};

export default App;
