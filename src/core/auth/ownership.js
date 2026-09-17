export function hasMatchingOwnership(authUid, storageUid, storeOwnerUid) {
  return (
    typeof authUid === "string" &&
    authUid.length > 0 &&
    authUid === storageUid &&
    authUid === storeOwnerUid
  );
}
