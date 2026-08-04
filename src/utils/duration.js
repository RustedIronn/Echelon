import {getMinutes} from "./time";

export function getDuration(task){

	const start=getMinutes(task.start);
	const end=getMinutes(task.end);

	return end-start;
}


export function getHeight(task){

	const duration=getDuration(task);

	if(duration<=15)return 1;
	if(duration<=30)return 2;
	if(duration<=60)return 3;
	if(duration<=120)return 4;
	if(duration<=180)return 5;

	return 6;
}