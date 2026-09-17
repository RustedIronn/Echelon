export const schedule=[
	{
		id:1,
		start:"05:30",
		end:"05:45",
		title:"Wake Up",
		category:"foundation",
		description:"Make bed, drink water, brush, no phone"
	},
	{
		id:2,
		start:"05:45",
		end:"06:30",
		title:"Exercise",
		category:"movement",
		description:"Workout — strength, mobility, or cardio"
	},
	{
		id:3,
		start:"06:30",
		end:"07:00",
		title:"Cooldown + Reset",
		category:"foundation",
		description:"Stretch, hydrate, recover"
	},
	{
		id:4,
		start:"07:00",
		end:"07:30",
		title:"Shower + Grooming",
		category:"foundation",
		description:"Shower, groom, dress properly"
	},
	{
		id:5,
		start:"07:30",
		end:"08:00",
		title:"Breakfast",
		category:"nourishment",
		description:"Eat, no scrolling"
	},
	{
		id:6,
		start:"08:00",
		end:"11:00",
		title:"Deep Work Block 1",
		category:"focus",
		description:"High focus work — Demeter, projects, learning"
	},
	{
		id:7,
		start:"11:00",
		end:"11:30",
		title:"Break",
		category:"unwind",
		description:"Walk, stretch, relax"
	},
	{
		id:8,
		start:"11:30",
		end:"13:30",
		title:"Deep Work Block 2",
		category:"focus",
		description:"Continue focused work"
	},
	{
		id:9,
		start:"13:30",
		end:"14:30",
		title:"Lunch + Relax",
		category:"nourishment",
		description:"Eat and take a proper break"
	},
	{
		id:10,
		start:"14:30",
		end:"17:30",
		title:"Growth Block",
		category:"build",
		description:"Projects, cooking, learning, errands"
	},
	{
		id:11,
		start:"17:30",
		end:"19:30",
		title:"Free Time",
		category:"unwind",
		description:"Gaming, anime, hobbies"
	},
	{
		id:12,
		start:"19:30",
		end:"20:15",
		title:"Dinner",
		category:"nourishment",
		description:"Eat with family, unwind"
	},
	{
		id:13,
		start:"20:15",
		end:"21:15",
		title:"Evening",
		category:"unwind",
		description:"Entertainment, hobbies, light work"
	},
	{
		id:14,
		start:"21:15",
		end:"21:45",
		title:"Shutdown",
		category:"foundation",
		description:"Clean desk, prepare tomorrow, phone away"
	},
	{
		id:15,
		start:"21:45",
		end:"22:00",
		title:"Sleep Preparation",
		category:"foundation",
		description:"Wind down and sleep"
	}
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const SCHEDULE_CATEGORY_IDS = Object.freeze([
	"foundation",
	"movement",
	"nourishment",
	"focus",
	"build",
	"unwind",
]);

const scheduleCategoryIds = new Set(SCHEDULE_CATEGORY_IDS);

const isValidId = (id) =>
	(typeof id === "string" && id.trim().length > 0) ||
	(typeof id === "number" && Number.isFinite(id));

const isValidScheduleItem = (task) =>
	task &&
	isValidId(task.id) &&
	typeof task.title === "string" &&
	task.title.trim().length > 0 &&
	scheduleCategoryIds.has(task.category) &&
	typeof task.description === "string" &&
	TIME_PATTERN.test(task.start) &&
	TIME_PATTERN.test(task.end) &&
	task.start < task.end;

const compareScheduleItems = (left, right) =>
	left.start.localeCompare(right.start) ||
	left.end.localeCompare(right.end) ||
	String(left.id).localeCompare(String(right.id));

// Persisted schedules are recovered item-by-item: malformed entries and later
// duplicate IDs are discarded, while valid siblings remain available. IDs and
// categories are never invented. An entirely unusable value returns null so
// callers can deliberately fall back to the built-in schedule.
export function normalizeScheduleItems(value) {
	if (!Array.isArray(value)) return null;

	const seenIds = new Set();
	const normalized = [];

	for (const task of value) {
		if (!isValidScheduleItem(task)) continue;

		const idKey = String(task.id);
		if (seenIds.has(idKey)) continue;

		seenIds.add(idKey);
		normalized.push({ ...task });
	}

	return normalized.length > 0 ? normalized.sort(compareScheduleItems) : null;
}

export function isValidSchedule(value) {
	const normalized = normalizeScheduleItems(value);
	return normalized !== null && normalized.length === value.length;
}

export function normalizeSchedule(value) {
	return normalizeScheduleItems(value) ?? schedule;
}

export function normalizeDailyTasks(value) {
	const normalized = normalizeScheduleItems(value);
	if (!normalized) return null;

	return normalized.map((task) => ({
		...task,
		done: task.done === true,
	}));
}
