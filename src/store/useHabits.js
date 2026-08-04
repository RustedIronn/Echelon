import {create} from "zustand";

import {
	saveData,
	loadData
} from "@utils/storage";

import {
	getToday,
	isNewDay
} from "@utils/date";

import {
	habits as defaultHabits
} from "@data/habits";

import {
	useAuth
} from "@store/useAuth";

import {
	saveHabits,
	loadHabits
} from "@services/habits";


const createHabits=()=>(
	defaultHabits.map(name=>({
		name,
		done:false
	}))
);


const saved=loadData(
	"lockin_habits",
	null
);


export const useHabits=create((set)=>({

	habits:
		saved &&
		!isNewDay(saved.date)
		?
		saved.data
		:
		createHabits(),


	toggleHabit:(name)=>
		set(state=>{

			const habits=state.habits.map(habit=>
				habit.name===name
				?
				{
					...habit,
					done:!habit.done
				}
				:
				habit
			);


			const data={
				date:getToday(),
				data:habits
			};


			saveData(
				"lockin_habits",
				data
			);


			const user=useAuth.getState().user;


			if(user){

				saveHabits(
					user.uid,
					getToday(),
					habits
				).catch(console.error);

			}


			return {
				habits
			};

		}),


	loadFromCloud:async()=>{

		const user=useAuth.getState().user;


		if(!user)
			return;


		try{

			const cloud=await loadHabits(
				user.uid,
				getToday()
			);


			if(cloud){

				set({
					habits:cloud.data
				});


				saveData(
					"lockin_habits",
					cloud
				);

			}

		}

		catch(error){

			console.error(
				"Habits sync failed:",
				error
			);

		}

	}

}));