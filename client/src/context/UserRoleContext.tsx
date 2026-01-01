import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUserRole } from "../lib/firebaseService";

type UserRoleContextType = { role: "admin" | "coadmin" | null };
const UserRoleContext = createContext<UserRoleContextType>({ role: null });

export const UserRoleProvider = ({ children }: { children: React.ReactNode }) => {
  const [role, setRole] = useState<"admin" | "coadmin" | null>(null);

  useEffect(() => {
    async function loadRole() {
      try {
        const r = await getCurrentUserRole();
        setRole(r);
      } catch {
        setRole(null);
      }
    }
    loadRole();
  }, []);

  return <UserRoleContext.Provider value={{ role }}>{children}</UserRoleContext.Provider>;
};

export const useUserRole = () => useContext(UserRoleContext);
