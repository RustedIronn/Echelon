import {getToday} from "./date";

export function generateReview({
	tasks,
	habits,
	sessions
}){

	const completedTasks=tasks.filter(
		task=>task.done
	).length;


	const taskScore=Math.round(
		(completedTasks/tasks.length)*100
	) || 0;


	const completedHabits=habits.filter(
		habit=>habit.done
	).length;


	const habitScore=Math.round(
		(completedHabits/habits.length)*100
	) || 0;


	const focusSeconds=sessions.reduce(
		(total,session)=>
			total+session.duration,
		0
	);


	const focusMinutes=Math.floor(
		focusSeconds/60
	);


	const score=Math.round(
		(taskScore*.5)+
		(habitScore*.3)+
		(Math.min(focusMinutes/240,1)*100*.2)
	);


	const wins=[];

	const improvements=[];


	if(taskScore>=80)
		wins.push(
			"Strong task execution"
		);
	else
		improvements.push(
			"Complete more planned tasks"
		);


	if(habitScore>=80)
		wins.push(
			"Good habit consistency"
		);
	else
		improvements.push(
			"Protect your daily habits"
		);


	if(focusMinutes>=120)
		wins.push(
			`${focusMinutes} minutes of focused work`
		);
	else
		improvements.push(
			"Increase deep work time"
		);


	return{
	date:getToday(),
	score,
	wins,
	improvements,
	focusMinutes
};

}