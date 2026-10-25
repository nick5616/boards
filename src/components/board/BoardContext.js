import { createContext, useContext } from "react";

// What a nested surface (a folder's tab) needs from the board around it:
// the board, how to draw and arrange modules, and the add / move / remove actions.
// createModule(type, { near, state, title }) → id lets a module make a sibling (see BoardView).
export const BoardContext = createContext(null);
export const useBoardContext = () => useContext(BoardContext);
