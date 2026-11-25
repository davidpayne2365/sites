// The story: a letter from the villain who trapped you in the maze, and one more in every final treasure chest.
// Letters answer what you have bought (a carpet, a horse, a hammer...) the first time they can; otherwise they
// carry the tale on in order, and once that runs out, a pool of taunts keeps coming. The villain is never found.

export const OPENING = {
  id: 'opening',
  text: `To my newest guest,

Welcome to my eternal maze. I placed you here while you slept, and here you will stay.

My hedges run on forever. Castles, palaces, fortresses and ruins stand among them, and more float in the sky.

Below lie dungeons, caves and old mines. Deeper still, glowing tunnels join vast caverns, each hiding a castle of its own.

Every place ends in a treasure chest. I am hiding in one of them. Find me, and I will set you free.

One more thing. A great stitched creature roams the walls. He never sleeps, and he never stops searching. If he finds you, he will take everything you own, and then he will take you.

Your host`,
};

// Answers to what you buy (each sent once, the first final chest after you own it).
export const BOUGHT = {
  torches: `Torches. How charming. Every little flame you carry is a beacon in the dark, and you are not the only one who can see it.

Your host`,
  lantern: `A lantern, so you can see in my deepest places. Be careful what you light up down there. Some things prefer the dark, and they remember who disturbed it.

Your host`,
  zipline: `I watched you fly along your little rope. Very clever. The creature watched too. He has learned that what goes up a rope must come down at the other end.

Your host`,
  hammer: `You broke one of my walls today. I felt it from across the maze. Go on, break another. Every wall you smash is one less wall between you and him.

Your host`,
  compass: `A compass that finds treasure. How useful. A shame it cannot find me. I made sure of that before you ever woke.

Your host`,
  boots: `New boots, I see. You jump higher now. The creature does not need to jump. He simply walks through.

Your host`,
  glider: `I saw you gliding from a high place, like a leaf on the wind. Leaves always land somewhere. I wonder if he will be waiting where you land.

Your host`,
  portals: `Doors of your own, stepping from one place to another. Clever. But every door you make is a door that can be walked through from the other side.

Your host`,
  horse: `A horse! Now you are faster than you were. Still not faster than him. Ride well, and do not look behind you.

Your host`,
  cloud: `You float on a cloud now, drifting over my walls like a ghost. It cannot lift you to my windows. I made the sky too high for clouds.

Your host`,
  carpet: `A flying carpet. You can reach my floating castles now. Do you really think I would live somewhere so easy to reach? Look closer to the ground.

Your host`,
};

// The tale, in order.
export const STORY = [
  `So you found my little treasure. How sweet. I was in this very room once, a long time ago. The dust remembers me. You are close, and you are nowhere near.

Your host`,
  `I can see you from my window. You walk the halls like a lost lamb. Look up the next time the moon is full. I will be the light that does not move.

Your host`,
  `The creature passed this door an hour ago. I let him sniff your boots. He liked the smell.

Your host`,
  `A riddle, since you are so clever. I live where the stairs run out, and I sleep where the water cannot reach. There are a hundred such places. Choose well.

Your host`,
  `You keep opening my chests and I keep filling them. Which of us do you think is enjoying this more?

Your host`,
  `My castle has a door that only opens from the inside. You walked past it this morning.

Your host`,
  `Do not trust the fountains. Do not trust the statues. And whatever you do, do not trust me.

Your host`,
  `I built this maze with my own hands, stone by stone, for a hundred years. You have seen perhaps a hundredth of it. Keep walking.

Your host`,
  `The creature was once a guest, just like you. He searched for me for so long that he forgot what he was searching for. Now he only searches for you.

Your host`,
  `Three towers, a red banner, and a gate that sings when it opens. That is all I will tell you today.

Your host`,
  `I left a candle burning in my window for you. Somewhere out there it is still burning. There are many windows.

Your host`,
  `You are getting richer. Gold is heavy, my friend. Heavy things are slow.

Your host`,
  `Every castle you have searched has been empty of me. Every castle you have not searched still might be. Do the sums.

Your host`,
  `I heard him roar last night. Did you? He was closer to you than you think.

Your host`,
  `I have been watching you sleep. You talk in your sleep. You say the word home a great deal.

Your host`,
  `The moss grows thickest on the north side of my walls. It grows thickest of all around my front door. Make of that what you will.

Your host`,
  `You climbed so many stairs to find this chest. I could have saved you the trouble. I could have, but I did not.

Your host`,
  `Somewhere in this maze is a castle with no treasure at all. That one is mine. I have no need for gold. I have you.

Your host`,
  `Halfway, perhaps. Or perhaps not even close. Isn't that the fun of it?

Your host`,
  `You are braver than the others. The others stopped opening my chests a long time ago. I do so miss the others.

Your host`,
];

// When the tale has run out: taunts that never end (picked without repeats until all have been read).
export const ENDLESS = [
  `Every chest you open, I write another letter. I could write forever. Can you search forever?

Your host`,
  `The creature is tired tonight. That only means he is walking slower. He has not stopped.

Your host`,
  `Still looking? Good. I would be so bored if you gave up.

Your host`,
  `Warmer. No, colder. No, warmer. I do love this game.

Your host`,
  `I moved last night, just to keep things interesting.

Your host`,
  `You missed a room in that last castle. I was in it.

Your host`,
  `I read your letters back to myself sometimes. Oh wait, you never write to me. How rude.

Your host`,
  `The maze is endless. My patience is endless. Is yours?

Your host`,
  `He found your footprints by the fountain. You should walk more softly.

Your host`,
  `If you ever find me, I promise to let you go. I always keep my promises. Mostly.

Your host`,
];
