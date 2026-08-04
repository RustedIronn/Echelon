import {create} from "zustand";
import {saveData,loadData} from "@utils/storage";
import {getToday} from "@utils/date";

export const useStats=create((set)=>({
	history:loadData(
		"lockin_history",
		[]
	),

	saveDay:(progress)=>{

		const history=loadData(
			"lockin_history",
			[]
		);

		const updated=[
			...history.filter(
				day=>day.date!==getToday()
			),
			{
				date:getToday(),
				progress
			}
		];

		saveData(
			"lockin_history",
			updated
		);

		set({
			history:updated
		});
	}

}));