export function createAuthTransitionController({
  setAuthState,
  setStorageOwner,
  resetSync = () => {},
  initializeProfile,
  onProfileError = () => {},
}) {
  let revision = 0;

  const handleAuthChange = async (user) => {
    const operationRevision = ++revision;

    // Remove the previous account from the interactive app immediately. The
    // next owner's local namespace is not exposed until profile initialization
    // has finished and this callback is still current.
    setAuthState({ user: null, loading: true });
    resetSync(null);
    setStorageOwner(null);

    if (!user) {
      if (operationRevision !== revision) return false;
      setAuthState({ user: null, loading: false });
      return true;
    }

    try {
      await initializeProfile(user);
    } catch (error) {
      onProfileError(error, user);
    }

    if (operationRevision !== revision) return false;

    // Store subscribers load the new namespace before the authenticated app
    // remounts. No mutation can pass the ownership guard until user is set.
    resetSync(user.uid);
    setStorageOwner(user.uid);
    setAuthState({ user, loading: false });
    return true;
  };

  return {
    handleAuthChange,
  };
}
