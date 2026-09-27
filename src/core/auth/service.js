import {
	GoogleAuthProvider,
	signInWithPopup,
	signOut
} from "firebase/auth";

import {
	auth
} from "../firebase";
import { isDesktop } from "@/desktop/environment";
import { beginDesktopGoogleLogin } from "@/desktop/auth";

const provider=new GoogleAuthProvider();


export async function loginWithGoogle(){
	if(isDesktop()){
		await beginDesktopGoogleLogin();
		return null;
	}

	const result=await signInWithPopup(
		auth,
		provider
	);

	return result.user;

}


export async function logout(){

	await signOut(auth);

}
