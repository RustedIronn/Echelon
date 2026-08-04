import {saveData,loadData} from "./storage";

const KEY="lockin_reviews";


export function saveReview(review){

	const reviews=loadData(
		KEY,
		[]
	);


	const updated=[
		...reviews,
		review
	];


	saveData(
		KEY,
		updated
	);


	return updated;
}


export function getReviews(){

	return loadData(
		KEY,
		[]
	);

}