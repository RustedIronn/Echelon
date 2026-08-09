export function generateWeeklyInsights(reviews){

	if(!reviews.length){
		return {
			average:0,
			best:null,
			worst:null,
			totalFocus:0
		};
	}


	const average=Math.round(
		reviews.reduce(
			(sum,review)=>
				sum+review.score,
			0
		)/reviews.length
	);


	const best=[...reviews]
		.sort(
			(a,b)=>b.score-a.score
		)[0];


	const worst=[...reviews]
		.sort(
			(a,b)=>a.score-b.score
		)[0];


	const totalFocus=reviews.reduce(
		(sum,review)=>
			sum+review.focusMinutes,
		0
	);


	return{
		average,
		best,
		worst,
		totalFocus
	};

}