import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { login as firebaseLogin, User } from "@/lib/firebaseService";

interface UserRoleContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export const UserRoleProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string) => {
    const u = await firebaseLogin(email, password);
    if (u) setUser(u);
    else throw new Error("Invalid credentials");
  };

  const logout = () => setUser(null);

  return (
    <UserRoleContext.Provider value={{ user, login, logout }}>
      {children}
    </UserRoleContext.Provider>
  );
};

export const useUserRole = () => {
  const context = useContext(UserRoleContext);
  if (!context) throw new Error("useUserRole must be used within UserRoleProvider");
  return context;
};
