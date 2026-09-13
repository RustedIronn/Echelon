import { useEffect, useState } from "react";

import {
  saveReview,
  saveReviews,
  getReviews,
  mergeReviews,
} from "./reviewStorage";
import { saveReviewCloud, loadReviewsCloud } from "./service";
import { syncToCloud, loadFromCloud } from "@core/cloudSync";

export default function useReview(review) {
  const [history, setHistory] = useState([]);
  const reviewSignature = review ? JSON.stringify(review) : "";

  useEffect(() => {
    let cancelled = false;
    const currentReview = reviewSignature
      ? JSON.parse(reviewSignature)
      : null;

    const syncReviews = async () => {
      const local = getReviews();
      let merged = local;

      if (!cancelled) setHistory(local);

      try {
        await loadFromCloud(
          (uid) => loadReviewsCloud(uid),
          (cloud) => {
            if (cancelled) return;

            merged = mergeReviews(cloud, local);
            saveReviews(merged);
            setHistory(merged);
          },
        );
      } catch {
        // loadFromCloud already reports the failure; keep the valid local history.
      }

      if (!currentReview || cancelled) return;

      const updated = saveReview(currentReview);

      setHistory(mergeReviews(merged, updated));
      syncToCloud((uid) => saveReviewCloud(uid, currentReview));
    };

    syncReviews();

    return () => {
      cancelled = true;
    };
  }, [reviewSignature]);

  return {
    history,
  };
}
