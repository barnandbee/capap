"use strict";
/* Capitalist Apocalypse — wire-up / bootstrap
   Part of the multi-file split (see README). Loaded as a classic <script>;
   all modules share one global scope until the planned ES-module step. */

/* ============================================================
   WIRE UP
   ============================================================ */
buildGovGrid();
document.getElementById("rollGovBtn").onclick=rollGov;
document.getElementById("startGameBtn").onclick=startGame;
document.getElementById("revealBtn").onclick=()=>{document.getElementById("passScreen").classList.add("hidden");render();};
