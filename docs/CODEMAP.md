# Echelon Code Map

This map records the current source tree during Stage 1. Current paths remain
authoritative until a later migration stage explicitly moves them. Target
ownership is directional only.

## Architectural rules

- Organize primarily by user-facing product domain.
- A feature owns its screens, UI, state, domain rules, persistence, transport,
  and styles.
- Cross-feature consumers import the specific implementation module they need.
- Feature-internal imports remain relative.
- Routes compose public feature screens; they do not contain feature rules.
- Shared code is domain-neutral. Platform code owns Firebase, UID-local storage,
  browser APIs, and Tauri integration.
- Storage keys, Firestore paths, revisions, ownership guards, and conflict rules
  are data contracts and are not changed by source-tree migration.
- Node-reachable relative ESM imports retain explicit file extensions.

## Source-tree naming convention

- Screens use descriptive nouns: `MoneyOverview.jsx`, `CalendarView.jsx`,
  `WorkoutHistory.jsx`.
- UI-only pieces use a role-bearing name: `TransactionDrawer.jsx`,
  `ScheduleTimeline.jsx`, `ReviewHistoryList.jsx`.
- Stores use `<feature>.store.js`; local persistence uses
  `<feature>.repository.js`; remote transport uses `<feature>.remote.js`.
- Domain modules name the fact they model (`transactions.js`, `sessions.js`,
  `scheduleTime.js`) instead of generic `utils.js` or `service.js`.
- Avoid feature API/barrel modules. Direct imports should make the dependency
  and its responsibility visible at the call site.
- Future physical migration replaces generic `service.js`, `utils.js`,
  `state.js`, `view.jsx`, and `panel.jsx` names with responsibility-bearing
  names.

## Application entry and lifecycle

| Responsibility | Current path | Target ownership |
|---|---|---|
| React entry, storage migration, auth/desktop initialization | `src/main.jsx` | App entry |
| Auth/loading/desktop frame root | `src/app/Root.jsx` | `app/App.jsx` |
| Authenticated lifecycle and router mount | `src/app/AppRoot.jsx` | `app/AppRuntime.jsx` |
| Routes and compatibility redirects | `src/app/routes.jsx` | `app/routing/routes.jsx` |
| Application shell | `src/app/layout/Layout.jsx` | `app/shell/AppShell.jsx` |
| Desktop/mobile navigation and navigation metadata | `src/app/layout/*` | `app/shell/*` |
| Global sync and day rollover | `src/hooks/useEchelonSync.js`, `src/hooks/useDayRollover.js` | `app/runtime/*` |
| Reminder scheduling | `src/features/notifications/js/useNotificationScheduler.js` | App runtime using Notifications API |
| Tauri application bridge | `src/desktop/bridge.js` | App runtime; low-level Tauri remains platform-owned |

## Route map

| Route | Current screen | State | Domain logic | Persistence / transport | Styles | Target ownership |
|---|---|---|---|---|---|---|
| `/` | `src/features/today/Today.jsx` | Schedule daily state, Planner, Focus surface | `dashboard/execution.js` | source domains | `dashboard/dashboard.css` | Today |
| `/plan/schedule` | `src/features/plan/schedule/Schedule.jsx` | Schedule + daily Schedule stores | Schedule defaults/editor/time | `echelon_schedule`, `echelon_today`; Schedule Firestore docs | `schedule/schedule.css` | Plan / Schedule |
| `/plan/planner/*` | `pages/Planner.jsx` → `planner/components/PlannerWorkspace.jsx` | Planner store | `planner/tasks.js` | `echelon_planner_v1` | `planner/planner.css` | Plan / Planner |
| `/plan/notes` | `plan/notes/NotesWorkspace.jsx` | Tools + Planner stores | Notes and Breakdowns domains | `echelon_tools_v1` | `tools/tools.css` | Plan / Notes |
| `/calendar` | `pages/Calendar.jsx` → `calendar/components/CalendarView.jsx` | Source domain stores | Calendar events/month | Derived only | `calendar/calendar.css` | Calendar |
| `/habits` | `pages/Habits.jsx` | Habits store | `habits/habits.js` | `echelon_habits`; `habits/{date}` | `habits/habits.css` | Habits |
| `/focus` | `focus/components/FocusCompatibility.jsx` | Focus + Focus surface stores | Focus runtime/missions/sessions | `echelon_focus`; `focusSessions/{id}` | `focus/focus.css` | Focus compatibility |
| `/workouts/*` | Workout components/layout | Workout store | runner, legacy tracking, history, plans | `echelon_workouts`, `echelon_workout_progress`; `workout/history` | `workout/workout.css` | Workouts |
| `/money/*` | Money layout/screens | Money store | transactions, budgets, goals, categories | `echelon_money_v1`; `money/state` | `money/money.css` | Money |
| `/insights` | Insights overview | Daily Review store | weekly review facts | Review persistence | analytics/review CSS | Insights / Overview |
| `/insights/daily` | `review/components/DailyReview.jsx` | Review + source feature stores | review generation/contributions | `echelon_reviews`; `reviews/{date}` | `review/review.css` | Insights / Daily Review |
| `/insights/composure` | `review/components/ComposureReview.jsx` | Composure store | composure normalization/metrics | `echelon_composure_v1` | `review/review.css` | Insights / Composure |
| `/insights/analysis` | `pages/Analytics.jsx` | Review, Focus, Workout stores | analysis series | Derived only | `analytics/analytics.css` | Insights / Analysis |
| `/settings` | `pages/Settings.jsx` | Source feature stores | source rules | source persistence | feature/global CSS | Settings |

## Compatibility routes

| Route family | Current destination | Reason retained |
|---|---|---|
| `/focus` | Contextual Focus surface | Existing links, tray actions, and desktop integrations |
| `/review`, `/review/composure` | Insights Daily/Composure | Legacy review links |
| `/analytics`, `/insights/trends` | Insights Analysis | Retired top-level Analytics/Trends naming |
| `/schedule`, `/planner/*` | Plan Schedule/Planner | Pre-consolidation links |
| `/tools/*` | Plan Notes/Planner, Focus, or Settings | Legacy Tools data and bookmarks |
| `/workouts/calendar`, `/workouts/progress` | Calendar or Workout History insight mode | Replaced Workout subroutes |

## Cross-feature imports

Consumers import the narrowest concrete file that owns the needed screen,
store, domain helper, or lifecycle command. This keeps the import graph
glanceable without making `index.js` or `*.api.js` an intermediary navigation
layer.

Repositories, storage adapters, Firestore transaction internals, sync controllers,
normalization internals, and state-machine transitions remain private.

## Persistence map

All local keys are UID-scoped through `src/shared/storage.js`.

| Domain | Local key | Cloud path | Integrity boundary |
|---|---|---|---|
| Schedule | `echelon_schedule` | `settings/schedule` | Schedule normalization/revision |
| Daily Schedule completion | `echelon_today` | `daily/{date}` | Day/revision reconciliation |
| Planner | `echelon_planner_v1` | None | Planner normalization |
| Notes, Breakdowns, legacy lanes, reset prefs | `echelon_tools_v1` | None | Tools v2 document/migration |
| Habits | `echelon_habits` | `habits/{date}` | Stable IDs/revision reconciliation |
| Focus | `echelon_focus` | `focusSessions/{id}` | Stable sessions/local day attribution |
| Workout history | `echelon_workouts` | `workout/history` | Runner plus legacy-history normalization |
| Active Workout | `echelon_workout_progress` | None | Runner v3 / legacy tracking snapshot |
| Money | `echelon_money_v1` | `money/state` | Money v2 transaction/revision sync |
| Daily Review | `echelon_reviews` | `reviews/{date}` | Valid one-record-per-date reconciliation |
| Composure | `echelon_composure_v1` | None | Composure v1 date upsert |
| Notifications | settings/history keys | None | Deterministic reminder ledger |
| Dormant history compatibility | `echelon_history` | None | Storage migration only; inactive runtime data |

## Approved cross-feature dependencies

- App runtime may orchestrate public feature lifecycle APIs.
- Today composes Plan, Focus, Habits, and Workouts without copying data.
- Calendar derives source-domain events and launches source-domain actions.
- Planner/Notes/Breakdowns may launch Focus or create Planner work.
- Daily Review reads normalized facts from Schedule, Habits, Focus, and Workouts.
- Insights/Analytics read review, Focus, and Workout history.
- Settings composes source-owned settings controls.
- The desktop bridge delegates to feature commands; low-level desktop adapters do
  not own feature state.

## Legacy and compatibility inventory

- `shared/storage.js` migrates `lockin_*` keys to UID-scoped `echelon_*` keys.
- `echelon_history` remains registered for backward compatibility only.
- `tools/LegacyToolsMigration.jsx` imports legacy lane tasks into Planner using
  deterministic IDs after a successful Planner write.
- `tools/storage.js` converts legacy Brain Dump data into Notes under the same
  Tools storage key.
- `tools/tasks.js` remains required to normalize legacy lane documents.
- `workout/tracking.js` and `TrackedWorkoutSession.jsx` preserve set-based data
  alongside the timed workout runner.
- Habits maps known legacy names to stable IDs.
- Review accepts valid legacy `{ date, score }` records.
- Focus derives local day keys for legacy ISO-only sessions.
- Compatibility redirects in `app/routes.jsx` preserve old bookmarks.

## Styling ownership

Current state:

- `src/index.css` imports global, shell, feature, auth, and desktop styles.
- `src/styles` owns tokens, base, forms, and primitives.
- `src/ui/ui.css` owns shared UI contracts and currently loads after feature CSS.
- Feature styles are still globally imported; Stage 1 does not alter this.

Target rules for later stages:

- Shared style foundation stays shared.
- Shell styles belong to the app shell.
- Feature CSS stays with its feature and does not override another feature.
- UI styling must not depend on loading after feature styles.
- No CSS moves occur before a visual baseline is selected and checkpointed.

## Dead-code verification queue

Static source-import analysis previously found no live importer for:

- `features/dashboard/components/DailyOverview.jsx`
- `features/dashboard/components/DayProgress.jsx`
- `features/dashboard/components/MinimumStandard.jsx`
- `features/dashboard/components/NonNegotiables.jsx`
- `features/dashboard/components/StatsRow.jsx`
- `features/dashboard/components/TodayPlanner.jsx`
- `features/dashboard/standards.js` if its consumers are removed
- `features/habits/components/HabitAnalytics.jsx`
- `features/schedule/components/WeekendPlan.jsx`
- `features/tools/components/OccupiedNowPrompt.jsx`
- `features/workout/components/TodayWorkout.jsx`
- `pages/Review.jsx` and `review/components/ReviewLayout.jsx`
- `ui/Section.jsx`, `ui/WorkspaceHeader.jsx`, and `ui/NavDropdown.jsx`

Tools actions that currently have no runtime consumer but may remain test or
compatibility contracts: `captureBrainDump`, `captureNote`,
`promoteBrainDump`, and `sendBreakdownStep`.

Nothing in this queue is deleted before dedicated route, test, migration, and
stored-data verification.
