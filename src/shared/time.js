export function getMinutes(time){
	const [hour,minute]=time.split(":").map(Number);

	return hour*60+minute;
}


export function getCurrentTask(tasks){

	const now=new Date();

	const current=
		now.getHours()*60+
		now.getMinutes();


	return tasks.find(task=>{
		const start=getMinutes(task.start);
		const end=getMinutes(task.end);

		return current>=start && current<end;
	});
}