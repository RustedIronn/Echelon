import { Card, Button } from "@ui";
import { useToast } from "@/ui/useToast";
import { useNotifications } from "../store";
import { PERMISSION_STATES } from "../permissions";
import { REMINDER_LEAD_OPTIONS } from "../constants";

const permissionLabels = {
  [PERMISSION_STATES.default]: "Not requested",
  [PERMISSION_STATES.granted]: "Granted",
  [PERMISSION_STATES.denied]: "Denied",
  [PERMISSION_STATES.unsupported]: "Unsupported",
};

export default function NotificationSettings() {
  const {
    settings,
    permission,
    updateSettings,
    updateQuietHours,
    enableBrowserNotifications,
  } = useNotifications();

  const requestPermission = async () => {
    const result = await enableBrowserNotifications();

    if (result === PERMISSION_STATES.granted) {
      useToast.getState().show("Browser notifications enabled");
    } else if (result === PERMISSION_STATES.denied) {
      useToast.getState().show("Browser notifications were denied", "error");
    }
  };

  return (
    <Card className="notification-settings">
      <div className="section-header">
        <h2>Notifications</h2>
        <p>Choose how Echelon reminds you about schedule items.</p>
      </div>

      <div className="stack">
        <div className="notification-setting">
          <div>
            <strong>Browser notifications</strong>
            <span>Permission: {permissionLabels[permission]}</span>
          </div>

          {permission === PERMISSION_STATES.granted ? (
            <label className="notification-toggle">
              <input
                type="checkbox"
                checked={settings.browserEnabled}
                onChange={(event) =>
                  updateSettings({ browserEnabled: event.target.checked })
                }
              />
              <span>{settings.browserEnabled ? "On" : "Off"}</span>
            </label>
          ) : permission === PERMISSION_STATES.default ? (
            <Button onClick={requestPermission}>
              Enable browser notifications
            </Button>
          ) : null}
        </div>

        {permission === PERMISSION_STATES.denied && (
          <p className="notification-note" role="status">
            Permission was denied. Enable notifications manually in your
            browser settings to use native reminders.
          </p>
        )}

        {permission === PERMISSION_STATES.unsupported && (
          <p className="notification-note" role="status">
            This browser does not support native notifications. In-app
            reminders will continue to work.
          </p>
        )}

        <label className="notification-setting">
          <span>
            <strong>Schedule reminders</strong>
            <small>Remind me about today&apos;s schedule items.</small>
          </span>
          <input
            type="checkbox"
            checked={settings.scheduleEnabled}
            onChange={(event) =>
              updateSettings({ scheduleEnabled: event.target.checked })
            }
          />
        </label>

        <label className="notification-setting">
          <span>
            <strong>Default reminder</strong>
            <small>Applied to every schedule item.</small>
          </span>
          <select
            value={settings.leadMinutes}
            disabled={!settings.scheduleEnabled}
            onChange={(event) =>
              updateSettings({ leadMinutes: Number(event.target.value) })
            }
          >
            {REMINDER_LEAD_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes === 0 ? "At start time" : `${minutes} minutes before`}
              </option>
            ))}
          </select>
        </label>

        <label className="notification-setting">
          <span>
            <strong>Quiet hours</strong>
            <small>Suppress reminders during this window.</small>
          </span>
          <input
            type="checkbox"
            checked={settings.quietHours.enabled}
            onChange={(event) =>
              updateQuietHours({ enabled: event.target.checked })
            }
          />
        </label>

        {settings.quietHours.enabled && (
          <div className="notification-time-range">
            <label>
              Start
              <input
                type="time"
                value={settings.quietHours.start}
                onChange={(event) =>
                  updateQuietHours({ start: event.target.value })
                }
              />
            </label>
            <label>
              End
              <input
                type="time"
                value={settings.quietHours.end}
                onChange={(event) =>
                  updateQuietHours({ end: event.target.value })
                }
              />
            </label>
          </div>
        )}
      </div>
    </Card>
  );
}
