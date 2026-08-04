import { useEffect, useState } from "react";

import { saveReview, getReviews } from "@utils/reviewStorage";

import { saveReviewCloud, loadReviewsCloud } from "@services/reviews";

import { useAuth } from "@store/useAuth";

export default function useReview(review) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const syncReviews = async () => {
      const local = getReviews();

      setHistory(local);

      const user = useAuth.getState().user;

      if (user) {
        const cloud = await loadReviewsCloud(user.uid);

        if (cloud.length) {
          setHistory(cloud);
        }
      }

      if (!review) return;

      const exists = local.some((item) => item.date === review.date);

      if (!exists) {
        const updated = saveReview(review);

        setHistory(updated);

        if (user) {
          saveReviewCloud(user.uid, review).catch(console.error);
        }
      }
    };

    syncReviews();
  }, [review?.date]);

  return {
    history,
  };
}
