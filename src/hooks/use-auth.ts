import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useAuth() {
  const token = localStorage.getItem("authToken");
  const user = useQuery(api.users.getCurrentUser, { token: token || undefined });
  const signOutMutation = useMutation(api.users.signOut);

  const isLoading = token !== null && user === undefined;
  const isAuthenticated = !!user;

  const signOut = async () => {
    await signOutMutation();
    localStorage.removeItem("authToken");
  };

  return {
    isAuthenticated,
    isLoading,
    user,
    signOut,
  };
}
