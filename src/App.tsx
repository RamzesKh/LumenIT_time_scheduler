import { useEffect, useMemo, useRef, useState } from "react";
import {
  createDefaultPeople,
  days,
  findCommonSlots,
  type DayKey,
  type Person,
} from "./availability";
import {
  TEAM_SCHEDULE_ROW_ID,
  TEAM_SCHEDULE_TABLE,
  supabase,
} from "./supabase";

const formatTimeHint = "Use 24-hour format like 09:00 and 17:30";
const channelName = "lumenit-team-schedule";

type SyncState = "loading" | "live" | "offline" | "error";
type RealtimeState =
  | "connecting"
  | "subscribed"
  | "timed-out"
  | "channel-error";

const isDailyAvailability = (
  value: unknown,
): value is { start: string; end: string } => {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { start?: unknown }).start === "string" &&
    typeof (value as { end?: unknown }).end === "string"
  );
};

const isPersonList = (value: unknown): value is Person[] => {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((person) => {
    if (typeof person !== "object" || person === null) {
      return false;
    }

    const candidate = person as {
      id?: unknown;
      name?: unknown;
      availability?: unknown;
    };

    return (
      typeof candidate.id === "number" &&
      typeof candidate.name === "string" &&
      typeof candidate.availability === "object" &&
      candidate.availability !== null &&
      days.every((day) =>
        isDailyAvailability(
          (candidate.availability as Record<string, unknown>)[day],
        ),
      )
    );
  });
};

const App = () => {
  const [people, setPeople] = useState<Person[]>(() => createDefaultPeople());
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] =
    useState<RealtimeState>("connecting");
  const hydratedRef = useRef(false);
  const lastSavedSnapshotRef = useRef<string>(
    JSON.stringify(createDefaultPeople()),
  );
  const saveTimerRef = useRef<number | null>(null);

  const commonSlots = useMemo(() => findCommonSlots(people), [people]);

  const syncLabel =
    syncState === "live"
      ? "Live shared board"
      : syncState === "loading"
        ? "Connecting"
        : syncState === "offline"
          ? "Local only"
          : "Sync error";

  const syncDescription =
    syncState === "live"
      ? "Everyone with the same board sees edits in real time."
      : syncState === "loading"
        ? "Loading the shared schedule..."
        : syncState === "offline"
          ? "Add Supabase env vars to turn on collaboration."
          : (syncError ?? "Realtime sync could not connect right now.");

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
    const defaultPeople = createDefaultPeople();
    lastSavedSnapshotRef.current = JSON.stringify(defaultPeople);
    setPeople(defaultPeople);

    if (!supabase) {
      return;
    }

    void supabase
      .from(TEAM_SCHEDULE_TABLE)
      .upsert({
        id: TEAM_SCHEDULE_ROW_ID,
        people: defaultPeople,
      })
      .then(({ error }) => {
        if (error) {
          setSyncError(error.message);
          setSyncState("error");
          return;
        }

        setSyncError(null);
        setSyncState("live");
      });
  };

  useEffect(() => {
    const sharedSupabase = supabase;

    if (!sharedSupabase) {
      hydratedRef.current = true;
      setSyncState("offline");
      setRealtimeState("connecting");
      return;
    }

    let active = true;

    const loadSharedSchedule = async () => {
      setSyncState("loading");

      const { data, error } = await sharedSupabase
        .from(TEAM_SCHEDULE_TABLE)
        .select("people")
        .eq("id", TEAM_SCHEDULE_ROW_ID)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (error && error.code !== "PGRST116") {
        setSyncError(error.message);
        setSyncState("error");
        hydratedRef.current = true;
        return;
      }

      const loadedPeople = isPersonList(data?.people) ? data.people : null;

      if (loadedPeople) {
        lastSavedSnapshotRef.current = JSON.stringify(loadedPeople);
        setPeople(loadedPeople);
      } else {
        const defaultPeople = createDefaultPeople();
        lastSavedSnapshotRef.current = JSON.stringify(defaultPeople);
        setPeople(defaultPeople);

        const { error: upsertError } = await sharedSupabase
          .from(TEAM_SCHEDULE_TABLE)
          .upsert({
            id: TEAM_SCHEDULE_ROW_ID,
            people: defaultPeople,
          });

        if (!active) {
          return;
        }

        if (upsertError) {
          setSyncError(upsertError.message);
          setSyncState("error");
          hydratedRef.current = true;
          return;
        }
      }

      hydratedRef.current = true;
      setSyncState("live");
    };

    void loadSharedSchedule();

    const channel = sharedSupabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: TEAM_SCHEDULE_TABLE,
          filter: `id=eq.${TEAM_SCHEDULE_ROW_ID}`,
        },
        (payload) => {
          const nextPeople = isPersonList(
            (payload.new as { people?: unknown } | null)?.people,
          )
            ? (payload.new as { people: Person[] }).people
            : null;

          if (nextPeople) {
            lastSavedSnapshotRef.current = JSON.stringify(nextPeople);
            setPeople(nextPeople);
            hydratedRef.current = true;
            setSyncState("live");
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeState("subscribed");
          return;
        }

        if (status === "TIMED_OUT") {
          setRealtimeState("timed-out");
          setSyncError(
            "Realtime subscription timed out. Check table publication and network access.",
          );
          setSyncState("error");
          return;
        }

        if (status === "CHANNEL_ERROR") {
          setRealtimeState("channel-error");
          setSyncError(
            "Realtime channel error. Ensure the table is in the realtime publication.",
          );
          setSyncState("error");
        }
      });

    return () => {
      active = false;
      void channel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const sharedSupabase = supabase;

    if (!sharedSupabase || !hydratedRef.current) {
      return;
    }

    const snapshot = JSON.stringify(people);

    if (snapshot === lastSavedSnapshotRef.current) {
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      const persistSchedule = async () => {
        const { error } = await sharedSupabase
          .from(TEAM_SCHEDULE_TABLE)
          .upsert({
            id: TEAM_SCHEDULE_ROW_ID,
            people,
          });

        if (error) {
          setSyncError(error.message);
          setSyncState("error");
          return;
        }

        lastSavedSnapshotRef.current = snapshot;
        setSyncState("live");
      };

      void persistSchedule();
    }, 250);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [people]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">LumenIT</p>
          <h1>Time Scheduler</h1>
          <p className="lede">
            Enter start and end times for each day. Everyone can edit the same
            board at the same time.
          </p>
        </div>
        <div className="hero-card">
          <span>LumenIT momentum</span>
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
