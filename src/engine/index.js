/* Capitalist Apocalypse — engine barrel.

   The complete DOM-free game core: data, deck, state, value engine and rules.
   Import from here in both the browser UI and Node tests:

     import { newGame, orgValue, score, S } from "./engine/index.js";

   Nothing in this folder touches the DOM, so the whole engine runs under Node. */
export * from "./data.js";
export * from "./deck.js";
export * from "./state.js";
export * from "./value.js";
export * from "./rules.js";
