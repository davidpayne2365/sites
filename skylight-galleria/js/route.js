// The one fixed route through the mall, the same for everyone.
// You start in the car park ('lot'), walk through the mall, out of the Grand Gate, then through these
// districts in this order, one after another in a straight line, and finally out through the Grand Exit ('exit').
// To reorder, change this list. Each name is a file in js/districts/.
const ROUTE = [
  'market',     // Old Town Market: open-air street market
  'dept',       // Hartwell & Co.: three-floor department store
  'aquarium',   // Deep Blue Aquarium: walk-through tunnel, mermaid and narwhals
  'arboretum',  // The Arboretum: glass conservatory (Bigfoot lives in the back grove)
  'forest',     // Whispering Pines: boardwalk through tall pines
  'rink',       // Glacier Ice Rink: skaters and a winter village
  'cinema',     // Paramount Lights: lobby, arcade, lounge and two theaters
  'amusement',  // Starlight Fair: night-time fair with rides
  'waterpark',  // Lagoon Splash: seven rideable waterslides
];
// names shown on the signs ("Next: …") and the directory boards
const TITLES = {
  market: 'Old Town Market', dept: 'Hartwell & Co.', aquarium: 'Deep Blue Aquarium', arboretum: 'The Arboretum',
  forest: 'Whispering Pines', rink: 'Glacier Ice Rink', cinema: 'Paramount Lights', amusement: 'Starlight Fair',
  waterpark: 'Lagoon Splash', exit: 'Grand Exit', lot: 'Car Park',
};
