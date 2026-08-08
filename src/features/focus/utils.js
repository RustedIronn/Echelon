export function getTotalFocusTime(sessions){

	return sessions.reduce(
		(total,session)=>
			total+session.duration,
		0
	);
}


export function getTodayFocusTime(sessions){

	const today=new Date()
		.toISOString()
		.split("T")[0];

	return sessions
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

	const hours=Math.floor(
		seconds/3600
	);

	const minutes=Math.floor(
		(seconds%3600)/60
	);

	if(hours)
		return `${hours}h ${minutes}m`;

	return `${minutes}m`;
}