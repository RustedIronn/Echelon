import { getRevision, resolveVersionedState } from "../../shared/versionedState.js";

const newerDocument = (left, right) =>
  !left || getRevision(right) >= getRevision(left) ? right : left;

export function createMoneySyncController({
  getContext,
  getLocalDocument,
  applyCloudDocument,
  setStatus,
  loadCloudDocument,
  saveCloudDocument,
  normalizeCloudDocument,
  selectContent,
  debounceMs = 200,
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancel = (handle) => clearTimeout(handle),
}) {
  let activeUid = null;
  let generation = 0;
  let queuedDocument = null;
  let timer = null;
  let writePromise = null;

  const isCurrent = (uid, operationGeneration = generation) => {
    const context = getContext();
    return (
      operationGeneration === generation &&
      activeUid === uid &&
      context.authUid === uid &&
      context.storeOwner === uid
    );
  };

  const clearScheduledWrite = () => {
    if (timer !== null) cancel(timer);
    timer = null;
  };

  const invalidate = () => {
    generation += 1;
    clearScheduledWrite();
    queuedDocument = null;
    writePromise = null;
    activeUid = null;
  };

  const queue = (uid, document, { immediate = false } = {}) => {
    if (!isCurrent(uid)) return false;

    queuedDocument = newerDocument(queuedDocument, document);
    setStatus(uid, "pending");
    clearScheduledWrite();

    if (!immediate) {
      timer = schedule(() => {
        timer = null;
        void flush(uid).catch(() => {});
      }, debounceMs);
    }
    return true;
  };

  const flush = async (uid) => {
    if (!isCurrent(uid)) return false;
    if (writePromise) return writePromise;
    if (!queuedDocument) return true;

    const operationGeneration = generation;
    const document = queuedDocument;
    queuedDocument = null;
    clearScheduledWrite();
    setStatus(uid, "syncing");

    writePromise = (async () => {
      try {
        const result = await saveCloudDocument(uid, document);
        if (!isCurrent(uid, operationGeneration)) return false;

        const remote = normalizeCloudDocument(result?.document);
        const local = getLocalDocument(uid);
        let cloudApplied = false;
        if (remote && local) {
          const resolution = resolveVersionedState(local, remote, selectContent);
          if (resolution.source === "cloud") {
            queuedDocument = null;
            if (!applyCloudDocument(uid, resolution.value)) {
              throw new Error("Unable to persist reconciled Money data.");
            }
            cloudApplied = true;
          }
        }

        const latest = getLocalDocument(uid);
        if (
          !cloudApplied &&
          latest &&
          getRevision(latest) > getRevision(document)
        ) {
          queuedDocument = newerDocument(queuedDocument, latest);
        }

        if (!queuedDocument) setStatus(uid, "synced");
        return true;
      } catch (error) {
        if (isCurrent(uid, operationGeneration)) {
          const latest = getLocalDocument(uid) ?? document;
          queuedDocument = newerDocument(queuedDocument, latest);
          setStatus(uid, "error", error);
        }
        throw error;
      } finally {
        if (operationGeneration === generation) writePromise = null;
      }
    })();

    const succeeded = await writePromise;
    if (succeeded && isCurrent(uid, operationGeneration) && queuedDocument) {
      return flush(uid);
    }
    return succeeded;
  };

  const reconcile = async (uid) => {
    if (!isCurrent(uid)) return false;
    const operationGeneration = generation;
    setStatus(uid, "syncing");

    try {
      const rawCloud = await loadCloudDocument(uid);
      if (!isCurrent(uid, operationGeneration)) return false;

      const local = getLocalDocument(uid);
      const cloud = normalizeCloudDocument(rawCloud);
      const resolution = resolveVersionedState(local, cloud, selectContent);

      if (resolution.source === "cloud") {
        clearScheduledWrite();
        queuedDocument = null;
        if (!applyCloudDocument(uid, resolution.value)) {
          throw new Error("Unable to persist reconciled Money data.");
        }
        setStatus(uid, "synced");
        return true;
      }

      if (resolution.shouldUpload && resolution.value) {
        queue(uid, resolution.value, { immediate: true });
        return flush(uid);
      }

      setStatus(uid, "synced");
      return true;
    } catch (error) {
      if (isCurrent(uid, operationGeneration)) setStatus(uid, "error", error);
      throw error;
    }
  };

  const activate = (uid) => {
    if (activeUid !== uid) {
      invalidate();
      activeUid = uid;
    }
    return reconcile(uid);
  };

  const recover = (uid) => {
    if (!isCurrent(uid)) return Promise.resolve(false);
    return queuedDocument ? flush(uid) : reconcile(uid);
  };

  return {
    activate,
    deactivate: (uid) => {
      if (activeUid === uid) invalidate();
    },
    enqueue: queue,
    flush,
    recover,
    isPending: () => queuedDocument !== null,
  };
}

export function bindMoneyRecoveryEvents(uid, recover, targets = {}) {
  const windowTarget = targets.windowTarget ?? globalThis.window;
  const documentTarget = targets.documentTarget ?? globalThis.document;
  const onRecovery = () => void recover(uid).catch(() => {});
  const onVisibility = () => {
    if (documentTarget?.visibilityState === "visible") onRecovery();
  };

  windowTarget?.addEventListener?.("online", onRecovery);
  windowTarget?.addEventListener?.("focus", onRecovery);
  documentTarget?.addEventListener?.("visibilitychange", onVisibility);

  return () => {
    windowTarget?.removeEventListener?.("online", onRecovery);
    windowTarget?.removeEventListener?.("focus", onRecovery);
    documentTarget?.removeEventListener?.("visibilitychange", onVisibility);
  };
}
