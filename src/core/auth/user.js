import {
	doc,
	setDoc,
	getDoc
} from "firebase/firestore";

import {
	db
} from "../firebase";


export async function createUserProfile(user){

	const ref=doc(
		db,
		"users",
		user.uid
	);


	const snapshot=await getDoc(ref);


	if(!snapshot.exists()){

		await setDoc(
			ref,
			{
				name:user.displayName,
				email:user.email,
				photo:user.photoURL,
				createdAt:new Date()
			}
		);

	}

}