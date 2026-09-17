export function getCompletedCount(tasks){
	return tasks.filter(
		task=>task.done
	).length;
}
