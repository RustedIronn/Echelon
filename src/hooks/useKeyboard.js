import {useEffect} from "react";

export default function useKeyboard(){

	useEffect(()=>{

		const handler=(e)=>{

			if(
				e.code==="Escape"
			){
				document.activeElement.blur();
			}

		};


		window.addEventListener(
			"keydown",
			handler
		);


		return()=>window.removeEventListener(
			"keydown",
			handler
		);

	},[]);

}