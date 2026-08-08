import { useEffect, useState } from "react";

import { saveReview, getReviews } from "./reviewStorage";
import { saveReviewCloud, loadReviewsCloud } from "./service";
import { syncToCloud, loadFromCloud } from "@core/cloudSync";

export default function useReview(review) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const syncReviews = async () => {
      const local = getReviews();

      setHistory(local);

      await loadFromCloud(
        (uid) => loadReviewsCloud(uid),
        (cloud) => {
          // preserve original semantic: don't clobber local with an empty cloud result
          if (!cloud.length) return;
          setHistory(cloud);
        },
      );

      if (!review) return;

      const exists = local.some((item) => item.date === review.date);

      if (!exists) {
        const updated = saveReview(review);

        setHistory(updated);
        syncToCloud((uid) => saveReviewCloud(uid, review));
      }
    };

    syncReviews();
  }, [review?.date]);

  return {
    history,
  };
}
