import { getToday } from "../../shared/date.js";

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidFocusDayKey(value) {
	const match = typeof value === "string" ? DAY_KEY_PATTERN.exec(value) : null;
	if (!match) return false;
	const [, year, month, day] = match.map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day;
}

export function getLocalDayKeyFromTimestamp(value, timezoneOffsetMinutes) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	const offset = Number.isFinite(timezoneOffsetMinutes)
		? timezoneOffsetMinutes
		: date.getTimezoneOffset();
	const local = new Date(date.getTime() - offset * 60 * 1000);
	return local.toISOString().slice(0, 10);
}

export function getFocusDayKey(session, timezoneOffsetMinutes) {
	if (isValidFocusDayKey(session?.dayKey)) return session.dayKey;
	return getLocalDayKeyFromTimestamp(session?.date, timezoneOffsetMinutes);
}

export function normalizeFocusSessions(sessions, options = {}) {
	if (!Array.isArray(sessions)) return [];

	return sessions
		.filter((session) =>
			session &&
			typeof session.task === "string" &&
			typeof session.date === "string" &&
			!Number.isNaN(Date.parse(session.date)) &&
			Number.isFinite(Number(session.duration)) &&
			Number(session.duration) >= 0,
		)
		.map((session) => {
			const dayKey = getFocusDayKey(
				session,
				options.timezoneOffsetMinutes,
			);
			return dayKey ? {
				...session,
				id: session.id || legacySessionId(session),
				dayKey,
				duration: Number(session.duration),
			} : null;
		})
		.filter(Boolean);
}

const sessionFingerprint = (session) =>
	[session.date, session.task, session.category || "", session.duration].join("|");

function legacySessionId(session) {
	const value = sessionFingerprint(session);
	let hash = 2166136261;

	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return `legacy-${(hash >>> 0).toString(36)}`;
}

export function mergeFocusSessions(localSessions, cloudSessions) {
	const merged = [];
	const seen = new Set();

	for (const session of [
		...normalizeFocusSessions(localSessions),
		...normalizeFocusSessions(cloudSessions),
	]) {
		const key = sessionFingerprint(session);

		if (seen.has(key)) continue;
		seen.add(key);
		merged.push(session);
	}

	return merged;
}

export function getTotalFocusTime(sessions){
	return normalizeFocusSessions(sessions).reduce(
		(total,session)=>
			total+session.duration,
		0
	);
}

export function getFocusSessionsForDay(sessions, dayKey, options = {}) {
	if (!isValidFocusDayKey(dayKey)) return [];
	return normalizeFocusSessions(sessions, options)
		.filter((session) => session.dayKey === dayKey);
}

export function getFocusTimeForDay(sessions, dayKey, options = {}) {
	return getFocusSessionsForDay(sessions, dayKey, options)
		.reduce(
			(total,session)=>
				total+session.duration,
			0
		);
}

export function getFocusMinutesForDay(sessions, dayKey, options = {}) {
	return Math.floor(getFocusTimeForDay(sessions, dayKey, options) / 60);
}

export function getTodayFocusTime(sessions, now = new Date()){
	return getFocusTimeForDay(sessions, getToday(now));
}


export function formatTime(seconds){
	const safeSeconds = Number.isFinite(Number(seconds))
		? Math.max(Number(seconds), 0)
		: 0;

	const hours=Math.floor(
		safeSeconds/3600
	);

	const minutes=Math.floor(
		(safeSeconds%3600)/60
	);

	if(hours)
		return `${hours}h ${minutes}m`;

	return `${minutes}m`;
}
