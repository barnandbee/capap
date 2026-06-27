/* Capitalist Apocalypse — browser entry point.
   Loaded as <script type="module" src="src/main.js">; it pulls in the whole
   ES-module graph (engine + ui + flow) and wires up the opening screen. */
import { buildGovGrid, rollGov, startGame } from "./setup.js";
import { render } from "./ui/render.js";

buildGovGrid();
document.getElementById("rollGovBtn").onclick=rollGov;
document.getElementById("startGameBtn").onclick=startGame;
document.getElementById("revealBtn").onclick=()=>{document.getElementById("passScreen").classList.add("hidden");render();};
