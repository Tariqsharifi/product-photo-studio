import { useConvexAuth } from "convex/react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export function useAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [user, setUser] = useState<any>(null);

  const signOut = useMutation(api.users.signOut);

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
  };

  return {
    isAuthenticated,
    isLoading,
    user,
    signOut: handleSignOut,
  };
}
