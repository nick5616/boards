import { createContext, useContext } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";

const Ctx = createContext(null);

export function IconOverridesProvider({ children }) {
  const [overrides, setOverrides] = useLocalStorage("myboards-icon-overrides", {});

  const setOverride = (stampId, override) =>
    setOverrides((prev) => ({ ...prev, [stampId]: override }));

  const clearOverride = (stampId) =>
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[stampId];
      return next;
    });

  return (
    <Ctx.Provider value={{ overrides, setOverride, clearOverride }}>
      {children}
    </Ctx.Provider>
  );
}

export const useIconOverrides = () => useContext(Ctx);
