import { useEffect, useMemo, useState } from "react";

import { Button, Card, EmptyState } from "@ui";
import { getToday } from "@/shared/date";
import { DAY_ROLLOVER_EVENT } from "@/shared/dayRollover";
import {
  countComposureChecks,
  createEmptyComposureChecks,
  getComposureWeeklyMetrics,
  parseComposureDate,
} from "../composure.js";
import {
  COMPOSURE_CHECKLIST,
  COMPOSURE_NOTE_MAX_LENGTH,
} from "../composureConstants.js";
import { useComposure } from "../composureStore.js";

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const formatDay = (day) => {
  const date = parseComposureDate(day);
  return date ? dayFormatter.format(date) : day;
};

const formatRating = (rating) => rating === null ? "Not rated" : `${rating} / 5`;

function ComposureForm({ day, today, saveToday }) {
  const [checks, setChecks] = useState(
    () => today?.checks ?? createEmptyComposureChecks(),
  );
  const [rating, setRating] = useState(today?.composureRating ?? null);
  const [tomorrowNote, setTomorrowNote] = useState(today?.tomorrowNote ?? "");
  const [status, setStatus] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const saved = saveToday({
      date: day,
      checks,
      composureRating: rating,
      tomorrowNote,
    });
    setStatus(saved ? "Saved for today." : "Unable to save this review.");
  };

  return (
    <Card className="composure-form-card">
      <div className="section-header">
        <h2>Today</h2>
        <p>A brief review of your own choices.</p>
      </div>

      <form onSubmit={submit}>
        <fieldset className="composure-checklist">
          <legend className="sr-only">Composure checklist</legend>
          {COMPOSURE_CHECKLIST.map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                checked={checks[item.id]}
                onChange={(event) => setChecks({
                  ...checks,
                  [item.id]: event.target.checked,
                })}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="composure-rating">
          <legend>How composed did I feel?</legend>
          <div>
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="composure-rating"
                  value={value}
                  checked={rating === value}
                  onChange={() => setRating(value)}
                />
                <span>{value}</span>
              </label>
            ))}
            {rating !== null ? (
              <Button className="composure-clear-rating" onClick={() => setRating(null)}>
                Clear
              </Button>
            ) : null}
          </div>
        </fieldset>

        <label className="composure-note">
          <span>What do I want to do differently tomorrow?</span>
          <textarea
            rows="3"
            maxLength={COMPOSURE_NOTE_MAX_LENGTH}
            value={tomorrowNote}
            onChange={(event) => setTomorrowNote(event.target.value)}
            placeholder="Explain once, then leave the conversation."
          />
          <small>{tomorrowNote.length} / {COMPOSURE_NOTE_MAX_LENGTH}</small>
        </label>

        <div className="composure-save-row">
          <Button type="submit">{today ? "Update Review" : "Save Review"}</Button>
          {status ? <span role="status">{status}</span> : null}
        </div>
      </form>
    </Card>
  );
}

export default function ComposureReview() {
  const { data, saveToday } = useComposure();
  const [day, setDay] = useState(() => getToday());
  const [selectedDate, setSelectedDate] = useState(null);
  const today = data.reviews.find((review) => review.date === day) ?? null;

  useEffect(() => {
    const handleRollover = () => {
      setDay(getToday());
      setSelectedDate(null);
    };
    window.addEventListener(DAY_ROLLOVER_EVENT, handleRollover);
    return () => window.removeEventListener(DAY_ROLLOVER_EVENT, handleRollover);
  }, []);

  const metrics = useMemo(
    () => getComposureWeeklyMetrics(
      data.reviews,
      parseComposureDate(day) ?? new Date(),
    ),
    [data.reviews, day],
  );
  const selected = selectedDate
    ? data.reviews.find((review) => review.date === selectedDate) ?? null
    : null;

  return (
    <div className="composure-layout">
      <ComposureForm
        key={day}
        day={day}
        today={today}
        saveToday={saveToday}
      />

      <div className="composure-side stack">
        <Card>
          <div className="section-header">
            <h2>This Week</h2>
            <p>Separate signals, not a combined score.</p>
          </div>
          <dl className="composure-metrics">
            <div><dt>Reviews</dt><dd>{metrics.reviewsCompleted}</dd></div>
            <div><dt>Average rating</dt><dd>{metrics.averageRating ?? "—"}</dd></div>
            <div><dt>Average checklist</dt><dd>{metrics.averageChecklistCompletion === null ? "—" : `${metrics.averageChecklistCompletion}%`}</dd></div>
          </dl>
        </Card>

        <Card>
          <div className="section-header">
            <h2>Recent</h2>
            <p>Newest first.</p>
          </div>
          {data.reviews.length ? (
            <div className="composure-history">
              {data.reviews.slice(0, 14).map((review) => (
                <button
                  type="button"
                  key={review.id}
                  className={selectedDate === review.date ? "is-selected" : ""}
                  onClick={() => setSelectedDate(
                    selectedDate === review.date ? null : review.date,
                  )}
                >
                  <span>{formatDay(review.date)}</span>
                  <span>{countComposureChecks(review)} / {COMPOSURE_CHECKLIST.length} checks</span>
                  <span>Composure: {formatRating(review.composureRating)}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No composure reviews yet"
              description="Today’s review will appear here after you save it."
            />
          )}
        </Card>

        {selected ? (
          <Card className="composure-detail">
            <div className="section-header">
              <h2>{formatDay(selected.date)}</h2>
              <p>Composure: {formatRating(selected.composureRating)}</p>
            </div>
            <div className="composure-detail-columns">
              <div>
                <h3>Checked</h3>
                <ul>{COMPOSURE_CHECKLIST.filter((item) => selected.checks[item.id]).map((item) => <li key={item.id}>{item.label}</li>)}</ul>
              </div>
              <div>
                <h3>Not checked</h3>
                <ul>{COMPOSURE_CHECKLIST.filter((item) => !selected.checks[item.id]).map((item) => <li key={item.id}>{item.label}</li>)}</ul>
              </div>
            </div>
            {selected.tomorrowNote ? (
              <div className="composure-detail-note">
                <h3>Tomorrow</h3>
                <p>{selected.tomorrowNote}</p>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
