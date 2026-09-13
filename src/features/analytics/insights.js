export function normalizeProgressHistory(history) {
	if (!Array.isArray(history)) return [];

	return history
		.filter((day) =>
			day &&
			typeof day.date === "string" &&
			Number.isFinite(Number(day.progress)),
		)
		.map((day) => ({
			...day,
			progress: Math.min(Math.max(Number(day.progress), 0), 100),
		}));
}

export function generateWeeklyInsights(reviews){
	const safeReviews = Array.isArray(reviews)
		? reviews.filter((review) =>
			review && Number.isFinite(Number(review.score)),
		).map((review) => ({
			...review,
			score: Math.min(Math.max(Number(review.score), 0), 100),
			focusMinutes: Number.isFinite(Number(review.focusMinutes))
				? Math.max(Number(review.focusMinutes), 0)
				: 0,
		}))
		: [];

	if(!safeReviews.length){
		return {
			average:0,
			best:null,
			worst:null,
			totalFocus:0
		};
	}


	const average=Math.round(
		safeReviews.reduce(
			(sum,review)=>
				sum+Number(review.score),
			0
		)/safeReviews.length
	);


	const best=[...safeReviews]
		.sort(
			(a,b)=>b.score-a.score
		)[0];


	const worst=[...safeReviews]
		.sort(
			(a,b)=>a.score-b.score
		)[0];


	const totalFocus=safeReviews.reduce(
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
