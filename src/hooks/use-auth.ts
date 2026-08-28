import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useAuth() {
  const token = localStorage.getItem("authToken") || undefined;
  const user = useQuery(api.users.getCurrentUser, { token });
  const isLoading = token !== undefined && user === undefined;
  const isAuthenticated = !!user;

  const signOutMutation = useMutation(api.users.signOut);
const handleSignOut = async () => {
    const token = localStorage.getItem("authToken") || undefined;
    await signOutMutation({ token });
    localStorage.removeItem("authToken");
    localStorage.removeItem("authEmail");
  };

  return {
    isAuthenticated,
    isLoading,
    user,
    signOut: handleSignOut,
  };
}
