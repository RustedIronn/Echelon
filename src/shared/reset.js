import {getToday} from "./date";
import {saveData} from "./storage";

export function resetStorage(key,data){

	saveData(
		key,
		{
			date:getToday(),
			data
		}
	);

}