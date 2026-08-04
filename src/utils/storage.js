export function saveData(key,data){
	localStorage.setItem(
		key,
		JSON.stringify(data)
	);
}

export function loadData(key,defaultValue){
	const data=localStorage.getItem(key);

	return data
		?JSON.parse(data)
		:defaultValue;
}