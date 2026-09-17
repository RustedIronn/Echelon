import { getToday } from "../../shared/date.js";
import { normalizeReviews } from "../review/reviews.js";

export function getCurrentLocalWeekRange(now = new Date()) {
	const anchor = new Date(now);
	if (Number.isNaN(anchor.getTime())) return null;

	const start = new Date(
		anchor.getFullYear(),
		anchor.getMonth(),
		anchor.getDate(),
	);
	const daysSinceMonday = (start.getDay() + 6) % 7;
	start.setDate(start.getDate() - daysSinceMonday);

	const end = new Date(start);
	end.setDate(start.getDate() + 6);

	return {
		start: getToday(start),
		end: getToday(end),
	};
}

export function getCurrentWeekReviews(reviews, now = new Date()) {
	const range = getCurrentLocalWeekRange(now);
	if (!range) return [];

	return normalizeReviews(reviews).filter(
		(review) => review.date >= range.start && review.date <= range.end,
	);
}

export function generateWeeklyInsights(reviews, now = new Date()){
	const safeReviews = getCurrentWeekReviews(reviews, now).map((review) => ({
		...review,
		focusMinutes: Number.isFinite(review.focusMinutes)
			? review.focusMinutes
			: 0,
	}));

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


	const best=safeReviews.length > 1
		? [...safeReviews]
			.sort(
				(a,b)=>b.score-a.score
			)[0]
		: null;


	const worst=safeReviews.length > 1
		? [...safeReviews]
			.sort(
				(a,b)=>a.score-b.score
			)[0]
		: null;


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
