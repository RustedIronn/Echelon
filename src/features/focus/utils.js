import { getToday } from "../../shared/date.js";

export function normalizeFocusSessions(sessions) {
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
		.map((session) => ({
			...session,
			id: session.id || legacySessionId(session),
			duration: Number(session.duration),
		}));
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


export function getTodayFocusTime(sessions){
	const today = getToday();

	return normalizeFocusSessions(sessions)
		.filter(session=>
			session.date.startsWith(today)
		)
		.reduce(
			(total,session)=>
				total+session.duration,
			0
		);
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
