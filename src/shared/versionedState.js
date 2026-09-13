export function getRevision(value) {
  const revision = Number(value?.revision);
  return Number.isInteger(revision) && revision >= 0 ? revision : 0;
}

const getTimestamp = (value) => {
  if (typeof value?.updatedAt !== "string") return null;
  const timestamp = Date.parse(value.updatedAt);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const sameContent = (left, right, selectContent) =>
  JSON.stringify(selectContent(left)) === JSON.stringify(selectContent(right));

export function createNextRevision(content, current, now = new Date()) {
  const updatedAt = now instanceof Date ? now.toISOString() : now;

  return {
    ...content,
    revision: getRevision(current) + 1,
    updatedAt,
  };
}

export function resolveVersionedState(
  local,
  cloud,
  selectContent = (value) => value,
) {
  if (!local && !cloud) {
    return { value: null, source: "equal", shouldUpload: false };
  }

  if (!local) {
    return { value: cloud, source: "cloud", shouldUpload: false };
  }

  if (!cloud) {
    return { value: local, source: "local", shouldUpload: true };
  }

  const localRevision = getRevision(local);
  const cloudRevision = getRevision(cloud);

  if (localRevision > cloudRevision) {
    return { value: local, source: "local", shouldUpload: true };
  }

  if (cloudRevision > localRevision) {
    return { value: cloud, source: "cloud", shouldUpload: false };
  }

  if (sameContent(local, cloud, selectContent)) {
    return { value: local, source: "equal", shouldUpload: false };
  }

  const localTimestamp = getTimestamp(local);
  const cloudTimestamp = getTimestamp(cloud);

  if (
    cloudTimestamp !== null &&
    (localTimestamp === null || cloudTimestamp > localTimestamp)
  ) {
    return { value: cloud, source: "cloud", shouldUpload: false };
  }

  // Equal revisions with conflicting or legacy/missing timestamps favor local
  // state. This prevents a load after a failed write from discarding the edit.
  return { value: local, source: "local", shouldUpload: true };
}

export async function reconcileVersionedState({
  local,
  cloud,
  selectContent,
  uploadLocal,
}) {
  const resolution = resolveVersionedState(local, cloud, selectContent);

  if (resolution.shouldUpload) {
    await uploadLocal(resolution.value);
  }

  return resolution;
}
