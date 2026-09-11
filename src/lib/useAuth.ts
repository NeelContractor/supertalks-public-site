import { useEffect } from "react";
import { useStore } from "./store";

export function useAuth() {
  const token = useStore((s) => s.token);
  const user = useStore((s) => s.user);
  const applyAuth = useStore((s) => s.applyAuth);
  const signOut = useStore((s) => s.signOut);

  useEffect(() => {
    void useStore.getState().hydrate();
  }, []);

  return { token, user, applyAuth, signOut };
}

export type UseAuth = ReturnType<typeof useAuth>;