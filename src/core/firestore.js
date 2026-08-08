import {
	doc,
	setDoc,
	getDoc
} from "firebase/firestore";

import {
	db
} from "./firebase";


export async function saveUserData(
	uid,
	collection,
	id,
	data
){

	await setDoc(
		doc(
			db,
			"users",
			uid,
			collection,
			id
		),
		data,
		{
			merge:true
		}
	);

}


export async function getUserData(
	uid,
	collection,
	id
){

	const snapshot=await getDoc(
		doc(
			db,
			"users",
			uid,
			collection,
			id
		)
	);


	if(snapshot.exists())
		return snapshot.data();


	return null;

}