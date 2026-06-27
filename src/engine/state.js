/* Capitalist Apocalypse — game state (DOM-free engine module).

   `S` is the single live game-state object. It is exported as a live binding:
   importers always see the current value because only this module reassigns it
   (via setActiveState). This keeps the rest of the engine reading `S` directly,
   exactly as the original single-file version did. */

export let S = null;

/** Replace the active game state and return it. The only place `S` is reassigned. */
export function setActiveState(s){ S = s; return S; }

export function newState(){
  return {
    players:[
      {id:0,name:"Player 1",hand:[],portfolio:[],eliminated:false,negatedHP:new Set(),blindSpotAgainst:null},
      {id:1,name:"Player 2",hand:[],portfolio:[],eliminated:false,negatedHP:new Set(),blindSpotAgainst:null}
    ],
    drawPile:[], discard:[], activeHP:[], government:null, ruler:null,
    current:0, actions:2, turn:1, log:[],
    cryptoPlayed:false, anyHPPlayed:false, allied:false,
    dolphinsCountdown:null, // turns left after dolphins
    over:false, result:null
  };
}
export const opp = p => S.players[1-p];
export const cur = () => S.players[S.current];

export function logEv(html){ if(!S) return; S.log.unshift(html); if(S.log.length>40) S.log.pop(); }
export function spend(n=1){ S.actions-=n; }
