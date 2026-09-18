export function getToday(date = new Date()){
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
}

export function isValidDayKey(value) {
	return parseDayKey(value) !== null;
}

export function parseDayKey(value) {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return null;
	}

	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(year, month - 1, day);

	return getToday(date) === value ? date : null;
}

export function formatDayKey(value, options = {}) {
	const date = parseDayKey(value);
	if (!date) return value;

	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		...options,
	}).format(date);
}

export function formatMonthKey(value) {
	if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return value;
	const date = parseDayKey(`${value}-01`);
	if (!date) return value;

	return new Intl.DateTimeFormat(undefined, {
		month: "long",
		year: "numeric",
	}).format(date);
}

export function getLocalWeekRange(reference = new Date()) {
	const date = reference instanceof Date
		? new Date(reference)
		: parseDayKey(reference);
	if (!date || Number.isNaN(date.getTime())) return null;

	date.setHours(0, 0, 0, 0);
	date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
	const end = new Date(date);
	end.setDate(end.getDate() + 6);

	return {
		start: getToday(date),
		end: getToday(end),
	};
}


export function isNewDay(savedDate){
	return savedDate!==getToday();
}
