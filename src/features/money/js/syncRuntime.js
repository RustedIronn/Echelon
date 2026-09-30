let mutationHandler = null;

export function registerMoneyMutationHandler(handler) {
  mutationHandler = typeof handler === "function" ? handler : null;
  return () => {
    if (mutationHandler === handler) mutationHandler = null;
  };
}

export function queueMoneyMutation(uid, document) {
  mutationHandler?.(uid, document);
}
