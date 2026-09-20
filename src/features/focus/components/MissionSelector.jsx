import { Crosshair } from "lucide-react";

import { Card, EmptyState } from "@ui";
import { categories } from "@features/schedule/categories";

export default function MissionSelector({ tasks, selectedId, onSelect, compact = false }) {
  const available = tasks.filter((task) => !task.done);

  return (
    <Card className={`mission-selector ${compact ? "is-compact" : ""}`.trim()}>
      <div className="section-header">
        <h2>{compact ? "Change mission" : "Choose a mission"}</h2>
        {!compact ? <p>Pick one planned block. The session will stay attached to it.</p> : null}
      </div>

      {available.length ? (
        <div className="mission-options">
          {available.map((task) => {
            const category = categories[task.category] ?? categories.foundation;
            return (
              <button
                key={task.id}
                type="button"
                className={`mission-option ${selectedId === task.id ? "is-selected" : ""}`.trim()}
                aria-pressed={selectedId === task.id}
                onClick={() => onSelect(task.id)}
              >
                <span
                  className="mission-option-icon"
                  style={{
                    "--mission-color": category.color,
                    "--mission-background": category.background,
                  }}
                  aria-hidden="true"
                >
                  <Crosshair size={16} />
                </span>
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.end ? `${task.start}–${task.end}` : task.start} · {category.name}</small>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No open missions"
          description="Reopen a Today block if you want to focus on it."
        />
      )}
    </Card>
  );
}
