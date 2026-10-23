import { createContext, useContext } from "react";

// { uid, updateBoard, logPractice, undoLog, toast }
const Ctx = createContext(null);

export const DataProvider = ({ value, children }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;

export const useData = () => useContext(Ctx);
