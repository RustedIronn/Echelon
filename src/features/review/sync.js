import {
  normalizeReview,
  normalizeReviews,
  reconcileReviewHistories,
  reviewsHaveEqualContent,
  upsertReview,
} from "./reviews.js";

export function createReviewSyncController({
  getContext,
  getLocalHistory,
  applyHistory,
  setStatus,
  loadCloudHistory,
  saveCloudReview,
  now = () => new Date(),
}) {
  let activeUid = null;
  let generation = 0;
  let activationPromise = null;
  let cloudHistory = [];
  let cloudReady = false;
  let cloudWinnerDates = new Set();
  let writeChain = Promise.resolve();

  const isCurrent = (uid, operationGeneration = generation) => {
    const context = getContext();
    return (
      operationGeneration === generation &&
      activeUid === uid &&
      context.authUid === uid &&
      context.storageOwner === uid &&
      context.storeOwner === uid
    );
  };

  const invalidate = () => {
    generation += 1;
    activeUid = null;
    activationPromise = null;
    cloudHistory = [];
    cloudReady = false;
    cloudWinnerDates = new Set();
    writeChain = Promise.resolve();
  };

  const write = (uid, review, operationGeneration) => {
    writeChain = writeChain.catch(() => false).then(async () => {
      if (!isCurrent(uid, operationGeneration)) return false;
      const latest = getLocalHistory(uid).find(
        (item) => item.date === review.date,
      );
      if (!latest) return false;

      setStatus(uid, "syncing");
      try {
        const result = await saveCloudReview(uid, latest);
        if (!isCurrent(uid, operationGeneration)) return false;
        const remote = normalizeReview(result?.review) ?? latest;
        if (!reviewsHaveEqualContent(remote, latest)) {
          const reconciled = reconcileReviewHistories(
            getLocalHistory(uid),
            [remote],
          ).history;
          if (!applyHistory(uid, reconciled)) {
            throw new Error("Unable to persist the newer cloud Review.");
          }
        }
        cloudHistory = normalizeReviews([
          ...cloudHistory.filter((item) => item.date !== remote.date),
          remote,
        ]);
        setStatus(uid, "synced");
        return true;
      } catch (error) {
        if (isCurrent(uid, operationGeneration)) setStatus(uid, "error", error);
        return false;
      }
    });

    return writeChain;
  };

  const activate = (uid) => {
    if (activeUid === uid && activationPromise) return activationPromise;
    if (activeUid !== uid) {
      invalidate();
      activeUid = uid;
    }
    const operationGeneration = generation;
    if (!isCurrent(uid, operationGeneration)) return Promise.resolve(false);
    setStatus(uid, "syncing");

    const pendingActivation = (async () => {
      try {
        await writeChain;
        if (!isCurrent(uid, operationGeneration)) return false;
        const rawCloud = await loadCloudHistory(uid);
        if (!isCurrent(uid, operationGeneration)) return false;

        cloudHistory = reconcileReviewHistories([], rawCloud).history;
        const localHistory = getLocalHistory(uid);
        const reconciliation = reconcileReviewHistories(localHistory, cloudHistory);
        const nextCloudWinnerDates = new Set(
          reconciliation.history
            .filter((winner) => {
              const local = localHistory.find((item) => item.date === winner.date);
              const cloud = cloudHistory.find((item) => item.date === winner.date);
              return (
                cloud &&
                reviewsHaveEqualContent(winner, cloud) &&
                (!local || !reviewsHaveEqualContent(local, cloud))
              );
            })
            .map((review) => review.date),
        );
        if (!applyHistory(uid, reconciliation.history)) {
          throw new Error("Unable to persist reconciled Review history.");
        }

        for (const review of reconciliation.uploads) {
          const saved = await write(uid, review, operationGeneration);
          if (!saved) return false;
        }

        if (!isCurrent(uid, operationGeneration)) return false;
        cloudWinnerDates = nextCloudWinnerDates;
        cloudReady = true;
        setStatus(uid, "synced");
        return true;
      } catch (error) {
        if (isCurrent(uid, operationGeneration)) setStatus(uid, "error", error);
        return false;
      }
    })();
    activationPromise = pendingActivation;
    void pendingActivation.finally(() => {
      if (operationGeneration === generation && activationPromise === pendingActivation) {
        activationPromise = null;
      }
    });

    return pendingActivation;
  };

  const save = async (uid, input) => {
    if (!isCurrent(uid)) return false;
    const operationGeneration = generation;
    const reconciled = activationPromise ? await activationPromise : true;
    if (!isCurrent(uid, operationGeneration)) return false;

    const result = upsertReview(getLocalHistory(uid), input, now());
    if (!result.review) return false;
    if (cloudWinnerDates.delete(result.review.date)) return true;
    if (result.changed && !applyHistory(uid, result.history)) {
      setStatus(uid, "error", new Error("Unable to persist Review history."));
      return false;
    }
    if (!reconciled || !cloudReady) return false;

    const cloudRecord = cloudHistory.find(
      (review) => review.date === result.review.date,
    );
    if (cloudRecord && reviewsHaveEqualContent(cloudRecord, result.review)) {
      setStatus(uid, "synced");
      return true;
    }

    return write(uid, normalizeReview(result.review), operationGeneration);
  };

  return {
    activate,
    save,
    deactivate: (uid) => {
      if (activeUid === uid) invalidate();
    },
    isCurrent,
  };
}
