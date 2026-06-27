/* Capitalist Apocalypse — card data & constants (DOM-free engine module).
   Pure data, no imports. Safe to load in the browser or under Node. */

export const GOVS = ["Theocracy","Dictatorship","Democracy","Communism","Monarchy","Anarchy"];
export const GOV_TEXT = {
  Theocracy:"No rule, all worship a divine presence. When it takes power, every player draws a Higher Power card.",
  Dictatorship:"The instigator rules and takes one random card from an opponent's hand at the start of each of their turns.",
  Democracy:"The ruler may draw up to 3 cards and resize one organisation once per turn.",
  Communism:"All organisations (in play and in hand) are pooled and shared evenly. RAIL CHOO CHOO flips positive; WOODOO'S halves; Great Health Service doubles.",
  Monarchy:"The ruler may freely pick card types. M. Smooth's value ×5; Mrs. Stone merges free.",
  Anarchy:"No rulers. Every takeover yields nothing extra here (1-for-1) but mergers are forbidden. NEF value ×5."
};
export const HP = [
  ["Cryptodisaster","All tech companies become worthless."],
  ["Mass Robot Uprising","Tech sector counts as every sector (gains all sector bonuses & merges)."],
  ["Sea Rise","The world is underwater. No effect alone, but enables Dolphins; some USPs react."],
  ["Encounter of the Third Kind","Aliens. Wellbeing companies grow to Giant size."],
  ["Electrobrainwash","Government can no longer be changed while in play."],
  ["Big Burn","Value of the public sector doubles."],
  ["Big Freeze","The world is frozen. No organisation cards can be played."],
  ["Capitalist Apocalypse","End game immediately."],
  ["False Idol","Forces Theocracy; government cannot change while in play."],
  ["Dolphins","If the world is underwater, dolphins take over — game ends after one more turn."],
  ["Return of the Dinosaurs","Value of natural resources and perishables doubles."]
];
// [name, text, qty]
export const ACTIONS = [
  ["Stock Crash","Decrease the size of a company by one level.",7],
  ["Build Stock","Increase the size of a company by one level.",9],
  ["Sneaky Corporate Deal","Swap a random card in your hand with a random card in your opponent's hand.",3],
  ["Merger","Merge two organisations you own of the same type into one Giant.",6],
  ["Hostile Takeover","Gain an organisation in your opponent's portfolio.",5],
  ["Regular Takeover","Swap one of your organisations in play for one of your opponent's.",5],
  ["Form An Alliance","Offer to combine portfolios with your opponent (shared value).",3],
  ["Generous Tax Break","All organisation cards in both hands must be put into play.",3],
  ["Absolutely Not, Mate","Roll a double to reverse any card just played. Played as a response.",3],
  ["Lawsuit","Delay (cancel) an incoming takeover or merger. Played as a response.",2],
  ["Break All Partnerships","End all alliances; organisations split evenly (breaker keeps majority).",1],
  ["Force An Alliance","Force your opponent into a combined portfolio with you.",1],
  ["Luddite Uprising","Negate Robot Uprising / Electrobrainwash / Cryptodisaster for everyone.",1],
  ["Dr. Dolittle","Negate Dolphins / Dinosaurs / Third Kind — for you only.",1],
  ["CEO Scandal","Reduce any Giant company to Enterprise.",1],
  ["Dragon's Den","Force the owner of a chosen company to give it to the other player for a random hand card.",1],
  ["It's 1929","All organisations in play drop to Start-up size.",1],
  ["Investment Portfolio","Take up to 3 organisation cards from the draw pile.",1],
  ["Massive Market Forces","Adam Smith's Ghost — both players swap their entire hands.",1],
  ["Angel Investor","Take over any Start-up from your opponent.",1],
  ["Cosmic Interference","Draw a Higher Power card from the deck into your hand.",1],
  ["Rebellion","Choose a new government type.",1],
  ["Break A Heart","End an alliance and decide how organisations are split.",1],
  ["Big Coat","Negate Big Freeze — for you only. Played as a response.",1],
  ["Rainbow Unicorn","Grow any Start-up straight to Giant.",1],
  ["Big Sun Hat","Negate Big Burn — for you only. Played as a response.",1],
  ["Alejandra, God Of Apocalypta","Negate False Idol for everyone. Played as a response.",1],
  ["Independence Day","Both players roll; a double rescinds a chosen Higher Power card.",1],
  ["The New Deal","All organisations in play rise to Giant size.",1],
  ["Big Surfboard","Negate Sea Rise — for you only. Played as a response.",1]
];
// [name, type, sizeIdx, [S,E,G], merge, usp]
export const ORGS = [
  ["Tablets 'n' That","Tech",1,["£0bn","£5bn","£50bn"],"×1","Once per game you may block a proposed merger."],
  ["Big Ol' Oil 'n' Gas","Natural Resources",2,["£1bn","£7bn","£70bn"],"×1","Worthless under Big Freeze, Sea Rise, Big Burn or Dolphins."],
  ["BESCO","Perishables",2,["£0.1bn","£5bn","£20bn"],"×3","Can merge with any tech company."],
  ["Big Bloody Search, Inc.","Tech",2,["£0bn","£0bn","£100bn"],"×1","Cannot be taken over. You lose the game if it is in play during Cryptodisaster."],
  ["Speedy Courier Plus","Services",0,["£0.1bn","£1bn","£15bn"],"×4","Can merge with all organisations."],
  ["Fit But You Know It Gyms","Wellbeing",1,["£0.01bn","£0.5bn","£4bn"],"×5","Value ×2 under Dolphins or Third Kind."],
  ["RAIL CHOO CHOO","Public",2,["£-5bn","£-50bn","£-100bn"],"×1","Under Communism multiply value by minus one."],
  ["Peachy 'n' Clean","Perishables",1,["£0.01bn","£0.5bn","£5bn"],"×2","Can be freely merged with any organisation."],
  ["Good Mind, Inc.","Wellbeing",1,["£0.01bn","£0.2bn","£3bn"],"×10","If merged with a tech organisation, merge multiplier becomes ×20."],
  ["National Enforcement Force","Public",2,["£2bn","£50bn","£60bn"],"×0","In Anarchy, value ×5."],
  ["H2OMG","Perishables",1,["£0.02bn","£0.5bn","£3bn"],"×10","Water World — under Big Burn, base value ×100."],
  ["NeoMode Fashion","Services",1,["£0.5bn","£1bn","£10bn"],"×3","In Big Burn or Big Freeze, value trebles."],
  ["Imaginary Friends","Wellbeing",0,["£0.01bn","£1bn","£15bn"],"×2","Under Robot Uprising, value ×3."],
  ["Hydropoly","Natural Resources",1,["£0.5bn","£2bn","£15bn"],"×2","Double value under Sea Rise. Half value under Big Burn."],
  ["Some Sort Of Social Media","Tech",1,["£0bn","£1bn","£10bn"],"×3","When merged with a services organisation, you may choose the government."],
  ["Drugtopia","Wellbeing",2,["£0bn","£5bn","£300bn"],"×3","Resists one takeover attempt per game."],
  ["M. Smooth's Grooming","Services",0,["£0.01bn","£0.2bn","£3bn"],"×2","Royal Seal: under Monarchy, value ×5."],
  ["Pizza D. Action","Perishables",0,["£0.1bn","£1bn","£10bn"],"×2","Dolphins like pizza — under Dolphins, value ×5."],
  ["Water Supply","Public",2,["£10bn","£30bn","£100bn"],"×-1","Worthless under Dolphins; merges with all in one go under Big Burn."],
  ["Fibre 2 Fibre","Public",2,["£0.3bn","£3bn","£25bn"],"×2","Can merge only with a tech organisation."],
  ["Golden Carrot Health Foods","Wellbeing",1,["£0.5bn","£2bn","£10bn"],"×2","Merges with a perishables organisation at ×5."],
  ["A-Video","Tech",1,["£0.1bn","£1bn","£30bn"],"×2","Out of the game if in play during Cryptodisaster."],
  ["WOODOO'S","Natural Resources",2,["£1bn","£4bn","£8bn"],"×2","Double value under Democracy, half under Communism."],
  ["Globo Bank TM","Services",2,["£1bn","£10bn","£40bn"],"×1","Worthless once Cryptodisaster has been played, for the rest of the game."],
  ["The Great Health Service","Public",2,["£8bn","£80bn","£100bn"],"×0","Doubles under Communism or after any Higher Power card (max £200bn)."],
  ["Mrs. Stone","Natural Resources",1,["£0.05bn","£10bn","£20bn"],"×1","In a Monarchy, merges free with same type."],
  ["Data Share, Inc.","Tech",0,["£0.01bn","£1bn","£50bn"],"×2","Out of the game if in play during Cryptodisaster."],
  ["Space Programme","Public",0,["£1bn","£10bn","£100bn"],"×0.5","Under Third Kind, value doubles."],
  ["Broadband, Baby!","Tech",0,["£0.5bn","£5bn","£20bn"],"×2","Can also merge with any services organisation."],
  ["SOLAR 1000","Natural Resources",0,["£0.1bn","£1bn","£10bn"],"×3","Under Big Burn, base value ×3."],
  ["Bill's Local News","Perishables",0,["£0.01bn","£0.1bn","£1bn"],"×10","Comrade Bill keeps it: not lost under Communism."],
  ["Happy Pill","Wellbeing",0,["£0.01bn","£1bn","£100bn"],"×0","Blind Spot — name a player; their action cards never affect you again."],
  ["Blue Steel","Natural Resources",0,["£0.2bn","£1bn","£10bn"],"×3","Under Mass Robot Uprising, value ×10."],
  ["Fran's Food","Perishables",2,["£0.5bn","£5bn","£50bn"],"×2","Only takeable by a player who owns 2+ perishables."],
  ["Globocorp TM","Services",2,["£0bn","£1bn","£50bn"],"×1","Start-up/Enterprise merged in ×2; a Giant merged in ×-1."],
  ["Mortar & Brick Builders","Services",1,["£0bn","£0.5bn","£3bn"],"×2","If its owner holds all 5 other sectors, value ×5."]
];
export const TYPE_COLORS={Tech:"#2f6f6a","Natural Resources":"#7a5a2e",Perishables:"#c8462f",
  Services:"#3a5a8c",Wellbeing:"#7a3a7a",Public:"#4a4a4a","Higher Power":"#8a1c4a",Action:"#a8761c"};
export const SIZES=["Start-up","Enterprise","Giant"];
export const SECTORS=["Tech","Natural Resources","Perishables","Services","Wellbeing","Public"];
