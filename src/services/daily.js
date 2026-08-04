import {
	doc,
	setDoc,
	getDoc
} from "firebase/firestore";

import {
	db
} from "@config/firebase";


export async function saveDaily(
	uid,
	date,
	data
){

	await setDoc(
		doc(
			db,
			"users",
			uid,
			"daily",
			date
		),
		data,
		{
			merge:true
		}
	);

}


export async function loadDaily(
	uid,
	date
){

	const snapshot=await getDoc(
		doc(
			db,
			"users",
			uid,
			"daily",
			date
		)
	);


	if(snapshot.exists()){
		return snapshot.data();
	}


	return null;

}