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

export function isValidSchedule(value) {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		!value.some((task) =>
			!task ||
			(typeof task.id !== "string" && typeof task.id !== "number") ||
			typeof task.title !== "string" ||
			typeof task.category !== "string" ||
			typeof task.description !== "string" ||
			!TIME_PATTERN.test(task.start) ||
			!TIME_PATTERN.test(task.end),
		)
	);
}

export function normalizeSchedule(value) {
	return isValidSchedule(value) ? value : schedule;
}

export function normalizeDailyTasks(value) {
	if (!Array.isArray(value)) return null;

	const normalized = normalizeSchedule(value);

	if (normalized === schedule && value !== schedule) return null;

	return normalized.map((task) => ({
		...task,
		done: task.done === true,
	}));
}
