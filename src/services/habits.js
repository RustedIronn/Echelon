import {
	doc,
	setDoc,
	getDoc
} from "firebase/firestore";

import {
	db
} from "@config/firebase";


export async function saveHabits(
	uid,
	date,
	data
){

	await setDoc(
		doc(
			db,
			"users",
			uid,
			"habits",
			date
		),
		{
			date,
			data
		},
		{
			merge:true
		}
	);

}


export async function loadHabits(
	uid,
	date
){

	const snapshot=await getDoc(
		doc(
			db,
			"users",
			uid,
			"habits",
			date
		)
	);


	if(snapshot.exists()){

		return snapshot.data();

	}


	return null;

}