import { createContext, useContext } from "react";

// What a nested surface (a folder's tab) needs from the board around it:
// the board, how to draw and arrange modules, and the add / move / remove actions.
export const BoardContext = createContext(null);
export const useBoardContext = () => useContext(BoardContext);
