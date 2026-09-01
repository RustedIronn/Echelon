export function calculateProgress(tasks){
	if(!tasks.length)return 0;

	const completed=tasks.filter(
		task=>task.done
	).length;

	return Math.round(
		(completed/tasks.length)*100
	);
}


export function getCompletedCount(tasks){
	return tasks.filter(
		task=>task.done
	).length;
}


export function getScore(tasks){
	const progress=calculateProgress(tasks);

	if(progress>=90)return "Excellent";
	if(progress>=70)return "Strong";
	if(progress>=40)return "Building";
	return "Starting";
}