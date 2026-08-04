export function getToday(){
	return new Date()
		.toISOString()
		.split("T")[0];
}


export function isNewDay(savedDate){
	return savedDate!==getToday();
}