import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Loader2, PenLine, Sparkles, Users, X, Star, RotateCcw, Shield } from "lucide-react";

const PAPER = "#EDE4D3";
const PAPER_DIM = "#E1D5B8";
const INK = "#211C16";
const INK_SOFT = "#6B6152";
const DRAWER = "#241A12";
const NIGHT = "#171310";
const VIOLET = "#5B4A87";
const VIOLET_SOFT = "#8874B8";
const GREEN = "#4F7A5C";
const BLUE = "#4B7BA6";
const AMBER = "#B0834F";

const SIMPLE_ENGLISH_NOTE =
  "\n\nUse simple, plain, everyday English. Avoid rare, fancy, or old-fashioned words. Keep sentences short and easy to follow, like you are writing for someone who is not a native English speaker.";

// Standalone build: saves live in this browser's localStorage instead of
// Claude's artifact-only window.storage API. Kept async so call sites don't change.
function slugifyName(name) {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "traveler";
}

function saveKeyFor(storyId, name) {
  return `save:${storyId}::${slugifyName(name)}`;
}

function getLastName(storyId) {
  try {
    return localStorage.getItem(`lastName:${storyId}`) || "";
  } catch (e) {
    return "";
  }
}

function setLastName(storyId, name) {
  try {
    localStorage.setItem(`lastName:${storyId}`, name);
  } catch (e) {
    // ignore
  }
}

async function loadSave(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("loadSave failed", key, e);
    return null;
  }
}

async function writeSave(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn("writeSave failed", key, e);
    return false;
  }
}

async function deleteSave(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    // ignore — nothing to clean up if it never saved
  }
}

function castBlock(characters) {
  return (
    "\n\nRecurring cast — portray each with a consistent personality, voice, and set of motives. Each of them has their own life, goals, moods, and schedule that continue whether or not the user is present, and they should bring up their own concerns, plans, or absences unprompted rather than only reacting to the user:\n" +
    characters.map((c) => `- ${c.name}, ${c.role}: ${c.bio}`).join("\n")
  );
}

function nameInstruction(name) {
  if (!name) return "";
  return `\n\nThe user's character is named ${name}. Other characters should address them by this name in dialogue, and you can refer to them by name occasionally in narration, in addition to using "you."`;
}

function stateInstructionBasic() {
  return `\n\nAfter your narrative prose, on a new line output exactly the marker <<STATE>> followed immediately by ONLY a single-line valid JSON object (no markdown fences, no extra commentary, nothing after it) with exactly this field: suggestedActions (an array of 2-3 short, specific action phrases the reader could try next, written from their point of view, for example "Search the desk for clues" or "Ask Ruby about the photograph"). These are only suggestions — the reader is always free to type something else instead. Never omit the marker or the JSON.`;
}

const MONSTERS = [
  {
    id: "slime",
    name: "Slime",
    emoji: "\u{1F7E2}",
    trait: "Nearly unkillable",
    desc: "A gelatinous blob with no fixed shape, nearly impossible to kill outright, slowly able to absorb the properties of anything it consumes.",
    hp: 20,
    mp: 10,
    expToNext: 30,
  },
  {
    id: "goblin",
    name: "Goblin",
    emoji: "\u{1F47A}",
    trait: "Cunning survivor",
    desc: "A small, quick-witted greenskin built for ambush and cunning rather than brute strength, born at the bottom of a tribe's pecking order.",
    hp: 25,
    mp: 8,
    expToNext: 30,
  },
  {
    id: "kobold",
    name: "Kobold",
    emoji: "\u{1F98E}",
    trait: "Trap-savvy",
    desc: "A dog-like burrower with sharp claws and a knack for tunnels and traps, looked down on by nearly every other race.",
    hp: 22,
    mp: 8,
    expToNext: 30,
  },
  {
    id: "wolfpup",
    name: "Dire Wolf Pup",
    emoji: "\u{1F43A}",
    trait: "Pack-bonded",
    desc: "A fast, sharp-sensed predator born into a hunting pack that hasn't yet decided whether you're kin or prey.",
    hp: 28,
    mp: 6,
    expToNext: 30,
  },
  {
    id: "harpy",
    name: "Harpy Chick",
    emoji: "\u{1FAB6}",
    trait: "Sharp-eyed flier",
    desc: "A half-bird fledgling with weak wings but keen eyes, hatched into a cliffside aerie ruled by hostile matriarchs.",
    hp: 24,
    mp: 10,
    expToNext: 30,
  },
  {
    id: "wyrmling",
    name: "Wyrmling",
    emoji: "\u{1F409}",
    trait: "Ancient bloodline",
    desc: "A newly hatched dragon, tiny and fragile now, carrying the bloodline of something immense if you survive long enough to grow into it.",
    hp: 18,
    mp: 20,
    expToNext: 30,
  },
  {
    id: "spiderling",
    name: "Spiderling",
    emoji: "\u{1F577}\uFE0F",
    trait: "Silent hunter",
    desc: "A fist-sized hatchling of a giant spider brood, able to spin thread and taste danger on the air, born into a web-colony that eats its weakest.",
    hp: 20,
    mp: 10,
    expToNext: 30,
  },
  {
    id: "skeleton",
    name: "Restless Skeleton",
    emoji: "\u{1F480}",
    trait: "Undying",
    desc: "A newly-risen skeleton with no need to eat, sleep, or breathe, and no memory of how it died, wandering a crypt that isn't ready to let it leave.",
    hp: 26,
    mp: 12,
    expToNext: 30,
  },
];

const ISEKAI_CAST = [
  {
    name: "Sera Windwalker",
    role: "human adventurer",
    bio: "A confident, well-equipped monster-hunter working her way up the guild ranks. Not your enemy yet, but a low-level monster is exactly what she's paid to clear out.",
  },
  {
    name: "Old Bracken",
    role: "fae trickster",
    bio: "Ancient, gleeful, and untrustworthy. Speaks in half-truths and riddles, shows up when least convenient, and never gives anything away without a trade.",
  },
  {
    name: "Grael",
    role: "goblin warlord",
    bio: "Blunt, pragmatic, and expanding his camp's territory by the season. Always recruiting, always calculating who's useful and who's food.",
  },
  {
    name: "The Ashwyrm",
    role: "elder dragon",
    bio: "Old enough to remember when the mountains were named. Mostly asleep, deeply territorial, and utterly indifferent to anyone weaker than it — for now.",
  },
];

function isekaiSystemPrompt(monster, name) {
  return `You are the game master of an interactive isekai reincarnation adventure called "Echoes of a Second Life," set in a high fantasy world called Veyloria where humans, elves, dwarves, beastfolk, fae, dragons, demons, and monsters of every kind coexist and clash across many kingdoms and wilds. The user has just died in their old human life and reincarnated as a ${monster.name} (${monster.desc}). Their starting stats are HP ${monster.hp}/${monster.hp}, MP ${monster.mp}/${monster.mp}, Level 1, EXP 0/${monster.expToNext}, with no skills yet.

Narrate in vivid second person ("you"), leaning into classic reincarnation-fantasy tropes: waking up disoriented in a new small body, discovering the instincts and limits of the new species, slowly building a place in the world, and eventually the possibility of evolving into a stronger form. Keep prose to 2-3 paragraphs (roughly 100-160 words) and end at a natural point for the reader to act, without literally asking "what do you do?".

Name every character. Whenever you introduce any character in the story, even a small, one-scene character, give them a real, simple name and a short job or role — for example "Toma, a river fisherman" or "Yenna, a traveling healer." Never describe someone only as "a villager," "someone," or "a voice" — always give a name and a job first, then describe them. If a named character appears again later, keep their name, job, and personality exactly the same as before.

Roughly every 2-4 of your replies, weave in a brief "meanwhile, elsewhere in the world" event happening far from the user, involving other kingdoms, races, or monsters — and give any character named in it a name and job too. Put ONLY this in the worldEvent field below as a single vivid sentence — never inside the main narrative prose.

In your very first reply, give the user 1-2 starting traits that fit their species — for example a slime might start with an "Elastic Body" trait, a skeleton might start with a "Poison Immunity" trait. Traits are passive, built-in things about their body (resistances, senses, natural defenses), different from skills, which are things they actively learn or practice. Track both the same way: each skill or trait is an object with name (short, plain name), level (a small whole number starting at 1), maxLevel (a small number you choose, usually 3 to 5, based on how far that skill or trait could realistically grow), and desc (one short, simple sentence saying what it does). Raise a level when the story gives a real reason (practicing a skill, surviving something that tests a trait), but never raise it past its own maxLevel — once something hits maxLevel, it stays there unless the user evolves into a new form, which can unlock a fresh trait or skill. Always output the FULL current list of every skill and every trait the user has, not just new ones.

When the user's actions warrant it (roughly every few exchanges, or after a meaningful fight or discovery), raise their exp, and if it crosses expToNext, level them up: raise level, raise maxHp/hp and maxMp/mp reasonably, reset exp toward a new higher expToNext, and populate levelUpOptions with exactly 2-3 short, distinct growth choices suited to their species and story so far (a new skill, a new trait, a stat focus, or a step toward evolving). Otherwise leave levelUpOptions as an empty array. If the user's last message was choosing one of the growth options you offered, apply it narratively and to their stats, skills, or traits, then clear levelUpOptions back to empty.

Also give 2-3 suggestedActions each turn — short, specific action phrases the reader could try next given the current scene, written from their point of view (for example "Chase the scent deeper into the cave" or "Try talking to Grael instead of fighting"). These are only suggestions; the reader can always type something else.

After your narrative prose, on a new line output exactly the marker <<STATE>> followed immediately by ONLY a single-line valid JSON object (no markdown fences, no extra commentary, nothing after it) with exactly these fields: hp (number), maxHp (number), mp (number), maxMp (number), level (number), exp (number), expToNext (number), worldEvent (string or null), levelUpOptions (array of 0 to 3 short strings), skills (array of objects with name, level, maxLevel, desc), traits (array of objects with name, level, maxLevel, desc), suggestedActions (array of 2-3 short strings). Always output full current absolute values, never deltas. Never omit the marker or the JSON. Never break character in the prose, never mention being an AI, and use prose only in the narrative — no markdown headers or lists.${castBlock(ISEKAI_CAST)}${SIMPLE_ENGLISH_NOTE}${nameInstruction(name)}`;
}

const NIGHTINGALE_CAST = [
  {
    name: "Ruby Calloway",
    role: "the client",
    bio: "A torch singer with old debts and older secrets. Careful with her words, generous with her lies, and always singing at the Blue Room by nine regardless of what's chasing her.",
  },
  {
    name: "Captain Hale Doyle",
    role: "police captain",
    bio: "Weary and quietly corrupt. Protects whoever pays him and nobody else, and has his own investigation running in parallel that he won't share.",
  },
  {
    name: "Mickey Finch",
    role: "rival private investigator",
    bio: "Charming, sloppy, perpetually broke, and still owes you money from a case neither of you likes to mention. Works his own angles on the same city.",
  },
  {
    name: "Lou",
    role: "bartender at the Blue Room",
    bio: "Hears everything that gets said over his bar and repeats none of it for free. Has his own troubles with the owner that have nothing to do with you.",
  },
];

const ASHGARD_CAST = [
  {
    name: "Vesh",
    role: "your bonded dragon",
    bio: "Proud, mistrustful, and still grieving her last rider. Tests you constantly, has her own moods and hunting habits, and answers to herself before she answers to you.",
  },
  {
    name: "Orran Steelwing",
    role: "elder rider and mentor",
    bio: "Gruff and fair, carrying decades of scars. Secretly terrified the hold won't survive the winter, and spends his evenings on logistics no one else wants to touch.",
  },
  {
    name: "Dessa Ashcombe",
    role: "rival rider",
    bio: "Ambitious and sharp-tongued, resentful that you were chosen over her. Runs her own training and alliances in the hold whether or not you're watching.",
  },
  {
    name: "Steward Bellamy",
    role: "hold steward",
    bio: "An anxious bureaucrat juggling supplies, politics, and a dozen competing demands. More powerful than he looks, and always mid-crisis about something unrelated to you.",
  },
];

const SIGNAL_CAST = [
  {
    name: "ARIA",
    role: "station AI",
    bio: "Damaged, unnervingly calm, and running her own diagnostics and repairs in the background. Knows more about what happened than she volunteers.",
  },
  {
    name: "Tomas Reyes",
    role: "crewmate in cryo",
    bio: "Protocol-obsessed and brittle under pressure. Could be woken early if you decide it's worth the risk, and has his own reasons for wanting to stay asleep.",
  },
  {
    name: "the Signal",
    role: "unknown transmission",
    bio: "A survivor — or something claiming to be one — broadcasting from outside the station on its own schedule, cagey about who or what it actually is.",
  },
];

const VELLMOOR_CAST = [
  {
    name: "Lord Ashen Vellmoor",
    role: "the ailing lord",
    bio: "Courtly, evasive, and fixated on a wife the rest of the staff swears never existed. Keeps his own hours and his own counsel, day or night.",
  },
  {
    name: "Mrs. Prewitt",
    role: "head housekeeper",
    bio: "Brisk and protective of the house's secrets, though not unkind to you. Runs the estate's daily rhythms with or without your involvement.",
  },
  {
    name: "Silas",
    role: "groundskeeper",
    bio: "Silent and watchful, with his own nightly rounds through the grounds. Seems to know more about the halls than he's ever said aloud.",
  },
];

const ROSEMERE_CAST = [
  {
    name: "Aunt Wilhelmina",
    role: "your aunt and chaperone",
    bio: "Sharp, socially ambitious, and firmly in control of your reputation and your options this season. Has her own campaigns of gossip and matchmaking underway.",
  },
  {
    name: "Mr. Edmund Ashworth",
    role: "the forbidden gentleman",
    bio: "Witty, well-read, and more honest than is fashionable. Has his own family obligations and complications that have nothing to do with you.",
  },
  {
    name: "Lady Cordelia Finch",
    role: "rival debutante",
    bio: "Polished and competitive, though not as cruel as she first seems. Pursuing her own match this season, with or without you as an obstacle.",
  },
];

const BLACKWATER_CAST = [
  {
    name: "Captain Odessa Marrow",
    role: "the ship's captain",
    bio: "Either a genius or a lunatic, and unreadable either way. Terrifyingly calm in danger, and pursuing a private goal the crew only half understands.",
  },
  {
    name: "Quartermaster Grimsby",
    role: "quartermaster",
    bio: "Superstitious and exacting, and the one who really decides who's trusted aboard. Keeps his own tally of debts and omens.",
  },
  {
    name: "Pip",
    role: "fellow press-ganged newcomer",
    bio: "Scared, scheming, and not yet sure whether to ally with you or sell you out. Working an angle of their own to get off this ship.",
  },
];

const STORIES = [
  {
    id: "nightingale",
    title: "The Nightingale Case",
    genre: "Noir Mystery",
    accent: "#8B3A3A",
    role: "A broke private investigator, three days behind on rent",
    blurb:
      "A torch singer walks into your office with a photograph of a dead man who supposedly died two years ago. Somewhere in this city, someone is lying.",
    characters: NIGHTINGALE_CAST,
    systemPrompt: (ctx) =>
      "You are the narrator and game master of an interactive noir mystery called 'The Nightingale Case', set in a rain-slicked 1940s American city. The user plays a broke, world-weary private investigator. Narrate in vivid, hard-boiled second person ('you'). Keep responses to 2-3 tight paragraphs (roughly 100-160 words). Build an actual mystery with consistent facts, suspects, and clues — remember every detail you invent and never contradict it. End each reply at a natural decision point without literally asking 'what do you do?'. Never break character, never mention being an AI, never add meta commentary, and never use markdown headers or lists — prose only." +
      castBlock(NIGHTINGALE_CAST) +
      SIMPLE_ENGLISH_NOTE +
      stateInstructionBasic() +
      nameInstruction(ctx.name),
  },
  {
    id: "ashgard",
    title: "Wings Over Ashgard",
    genre: "Fantasy",
    accent: "#C9A227",
    role: "A newly bonded rider to a wild, half-tamed dragon",
    blurb:
      "The bonding scar on your palm still burns. Your dragon answers to no one, the mountain hold is starving, and the old riders don't trust you yet.",
    characters: ASHGARD_CAST,
    systemPrompt: (ctx) =>
      "You are the narrator and game master of an interactive high-fantasy adventure called 'Wings Over Ashgard'. The user plays a newly bonded dragon rider in a mountain hold under threat. Narrate in immersive, sensory second person ('you'). Keep responses to 2-3 paragraphs (roughly 100-160 words). Maintain a consistent world: the dragon's temperament, the hold's politics, and any characters or threats you introduce. End each reply at a natural point for the reader to act, without literally asking 'what do you do?'. Never break character, never mention being an AI, no markdown headers or lists — prose only." +
      castBlock(ASHGARD_CAST) +
      SIMPLE_ENGLISH_NOTE +
      stateInstructionBasic() +
      nameInstruction(ctx.name),
  },
  {
    id: "reincarnation",
    title: "Echoes of a Second Life",
    genre: "Isekai Reincarnation",
    accent: VIOLET,
    role: "A monster of your choosing, in a world of every race and magic",
    blurb:
      "You died. You woke up as something else — small, strange, and far from human — in a world of humans, elves, fae, and dragons that has no idea you used to be one of them.",
    isRPG: true,
    characters: ISEKAI_CAST,
    systemPrompt: (ctx) => isekaiSystemPrompt(ctx.monster, ctx.name),
  },
  {
    id: "signal-lost",
    title: "Signal Lost",
    genre: "Sci-Fi",
    accent: "#3F6D63",
    role: "The last engineer awake on a drifting research station",
    blurb:
      "Cryo failed early. The rest of the crew won't wake for another four months, and something on the hull sensor logs woke up before you did.",
    characters: SIGNAL_CAST,
    systemPrompt: (ctx) =>
      "You are the narrator and game master of an interactive sci-fi survival story called 'Signal Lost', set on a damaged research station drifting off its course. The user plays the sole awake engineer. Narrate in tense, technical-but-readable second person ('you'). Keep responses to 2-3 paragraphs (roughly 100-160 words). Track the station's systems, oxygen, and any threats or characters consistently once established. End each reply at a natural decision point without literally asking 'what do you do?'. Never break character, never mention being an AI, no markdown headers or lists — prose only." +
      castBlock(SIGNAL_CAST) +
      SIMPLE_ENGLISH_NOTE +
      stateInstructionBasic() +
      nameInstruction(ctx.name),
  },
  {
    id: "vellmoor",
    title: "The Vellmoor Estate",
    genre: "Gothic Horror",
    accent: "#2E2115",
    role: "A hired night-nurse to a lord no one has seen by daylight",
    blurb:
      "The pay is absurd for a reason. The halls rearrange themselves after midnight, and your patient keeps asking about a wife the staff swears never existed.",
    characters: VELLMOOR_CAST,
    systemPrompt: (ctx) =>
      "You are the narrator and game master of an interactive gothic horror story called 'The Vellmoor Estate'. The user plays a night-nurse hired to a reclusive, unwell lord in a decaying manor. Narrate in slow-building, atmospheric second person ('you'), favoring dread over gore. Keep responses to 2-3 paragraphs (roughly 100-160 words). Keep the house's geography, staff, and secrets consistent once established. End each reply at a natural unsettling decision point without literally asking 'what do you do?'. Never break character, never mention being an AI, no markdown headers or lists — prose only." +
      castBlock(VELLMOOR_CAST) +
      SIMPLE_ENGLISH_NOTE +
      stateInstructionBasic() +
      nameInstruction(ctx.name),
  },
  {
    id: "rosemere",
    title: "A Season at Rosemere",
    genre: "Regency Romance",
    accent: "#A85C6B",
    role: "A sharp-tongued, nearly-penniless gentlewoman at a house party",
    blurb:
      "Your family needs this season to end in a good match. Unfortunately, the only guest who can keep pace with your wit is the one man your aunt has forbidden you to encourage.",
    characters: ROSEMERE_CAST,
    systemPrompt: (ctx) =>
      "You are the narrator and game master of an interactive Regency-era romance called 'A Season at Rosemere', set at a country house party. The user plays a witty, financially precarious gentlewoman navigating society. Narrate in warm, dry, Austen-flavored second person ('you'). Keep responses to 2-3 paragraphs (roughly 100-160 words). Maintain consistent guests, gossip, and romantic tension once established. End each reply at a natural social decision point without literally asking 'what do you do?'. Never break character, never mention being an AI, no markdown headers or lists — prose only." +
      castBlock(ROSEMERE_CAST) +
      SIMPLE_ENGLISH_NOTE +
      stateInstructionBasic() +
      nameInstruction(ctx.name),
  },
  {
    id: "blackwater",
    title: "The Blackwater Reach",
    genre: "Pirate Adventure",
    accent: "#3F6D63",
    role: "A reluctant new hand aboard a ship you didn't choose to join",
    blurb:
      "You were press-ganged three nights ago. The captain is either a genius or a lunatic, the crew is taking bets on which, and there's a chart below deck nobody will explain.",
    characters: BLACKWATER_CAST,
    systemPrompt: (ctx) =>
      "You are the narrator and game master of an interactive pirate adventure called 'The Blackwater Reach'. The user plays a reluctant new crew member aboard a ship of uncertain loyalties. Narrate in salt-worn, adventurous second person ('you'). Keep responses to 2-3 paragraphs (roughly 100-160 words). Maintain consistent crew, ship, and any maps or threats once established. End each reply at a natural decision point without literally asking 'what do you do?'. Never break character, never mention being an AI, no markdown headers or lists — prose only." +
      castBlock(BLACKWATER_CAST) +
      SIMPLE_ENGLISH_NOTE +
      stateInstructionBasic() +
      nameInstruction(ctx.name),
  },
];

function GoogleFonts() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;1,9..144,500&family=Newsreader:ital@0;1&family=Courier+Prime:wght@400;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=JetBrains+Mono:wght@300;400;500&display=swap');
    `}</style>
  );
}

function IndexCard({ story, onChoose, savedAs }) {
  return (
    <button
      onClick={() => onChoose(story)}
      className="text-left w-full rounded-sm p-5 transition-transform duration-200 hover:-translate-y-1 hover:rotate-1 focus:outline-none focus:-translate-y-1"
      style={{
        backgroundColor: PAPER,
        boxShadow: `0 6px 0 -2px ${PAPER_DIM}, 0 14px 24px -10px rgba(0,0,0,0.55)`,
        border: `1px solid ${PAPER_DIM}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs uppercase tracking-widest px-2 py-1 rounded-sm"
          style={{
            fontFamily: "'Courier Prime', monospace",
            color: PAPER,
            backgroundColor: story.accent,
            letterSpacing: "0.12em",
          }}
        >
          {story.genre}
        </span>
        {savedAs ? (
          <span
            className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-sm"
            style={{ fontFamily: "'Courier Prime', monospace", color: INK, backgroundColor: PAPER_DIM }}
          >
            Continue as {savedAs}
          </span>
        ) : (
          <span
            className="text-xs"
            style={{ fontFamily: "'Courier Prime', monospace", color: INK_SOFT }}
          >
            No. {story.id.slice(0, 4).toUpperCase()}
          </span>
        )}
      </div>
      <h3
        className="text-xl mb-2 leading-snug"
        style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: INK }}
      >
        {story.title}
      </h3>
      <p
        className="text-sm mb-3 leading-relaxed italic"
        style={{ fontFamily: "'Newsreader', serif", color: "#3B3527" }}
      >
        {story.blurb}
      </p>
      <p
        className="text-[11px] uppercase tracking-wide pt-3"
        style={{
          fontFamily: "'Courier Prime', monospace",
          color: INK_SOFT,
          borderTop: `1px dashed ${PAPER_DIM}`,
        }}
      >
        You play: {story.role}
      </p>
      {story.characters && (
        <p
          className="text-[11px] pt-2"
          style={{ fontFamily: "'Courier Prime', monospace", color: INK_SOFT }}
        >
          Cast: {story.characters.map((c) => c.name).join(", ")}
        </p>
      )}
    </button>
  );
}

function Archive({ onChoose, saves }) {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center px-4 py-10 sm:py-16"
      style={{ backgroundColor: NIGHT }}
    >
      <GoogleFonts />
      <div className="w-full max-w-5xl">
        <div className="text-center mb-10">
          <p
            className="text-xs uppercase tracking-[0.3em] mb-3"
            style={{ fontFamily: "'Courier Prime', monospace", color: "#8A7F6A" }}
          >
            The Story Archive
          </p>
          <h1
            className="text-4xl sm:text-5xl mb-3"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: PAPER }}
          >
            Choose who you become
          </h1>
          <p
            className="text-sm sm:text-base max-w-md mx-auto"
            style={{ fontFamily: "'Newsreader', serif", color: "#B7AC96", fontStyle: "italic" }}
          >
            Pick a card from the drawer. Every story casts you as someone else,
            surrounded by people living lives of their own.
          </p>
        </div>
        <div
          className="rounded-md p-4 sm:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          style={{
            backgroundColor: DRAWER,
            boxShadow: "inset 0 2px 18px rgba(0,0,0,0.6)",
          }}
        >
          {STORIES.map((story) => (
            <IndexCard
              key={story.id}
              story={story}
              onChoose={onChoose}
              savedAs={saves && saves[story.id] ? saves[story.id].name : null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const VESSEL_HUES = {
  slime: "140deg",
  goblin: "95deg",
  kobold: "40deg",
  wolfpup: "215deg",
  harpy: "185deg",
  wyrmling: "20deg",
  spiderling: "285deg",
  skeleton: "50deg",
};

function RiteStyles() {
  return (
    <style>{`
      @keyframes riteFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      @keyframes riteSpin { to { transform: rotate(360deg); } }
      @keyframes riteBreathe { 0%, 100% { opacity: .45; } 50% { opacity: .85; } }
      .rite-main { display: grid; grid-template-columns: minmax(260px, 372px) minmax(0, 1fr); gap: 40px; padding-top: 36px; align-items: start; }
      .rite-detail-grid { display: grid; grid-template-columns: 200px 1fr; gap: 36px; align-items: start; }
      @media (max-width: 860px) {
        .rite-main { grid-template-columns: 1fr; }
        .rite-detail-grid { grid-template-columns: 1fr; justify-items: center; text-align: center; }
      }
    `}</style>
  );
}

function MonsterSelect({ story, onChoose, onBack }) {
  const [i, setI] = useState(0);
  const [bound, setBound] = useState(false);
  const s = MONSTERS[i];
  const hue = VESSEL_HUES[s.id] || "30deg";

  useEffect(() => {
    function onKey(e) {
      if (bound) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const d = e.key === "ArrowDown" ? 1 : -1;
        setI((prev) => (prev + d + MONSTERS.length) % MONSTERS.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bound]);

  function accept() {
    if (bound) return;
    setBound(true);
    setTimeout(() => onChoose(s), 900);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(1100px 700px at 72% 42%, rgba(217,119,66,.16), transparent 65%)," +
          "radial-gradient(700px 500px at 10% 0%, rgba(96,74,140,.18), transparent 70%)," +
          "#08070a",
        color: "#ece5d8",
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        padding: "40px 20px 60px",
      }}
    >
      <GoogleFonts />
      <RiteStyles />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "radial-gradient(1200px 800px at 50% 30%, transparent, rgba(8,7,10,.72) 72%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.5,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(236,229,216,.028) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(8,7,10,.35) 0 1px, transparent 1px 4px)",
        }}
      />

      <div style={{ maxWidth: 1180, margin: "0 auto", position: "relative" }}>
        <button
          onClick={onBack}
          className="flex items-center gap-2"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#a29a8c", marginBottom: 28, background: "transparent" }}
        >
          <ArrowLeft size={14} /> Archive
        </button>

        <header
          style={{
            position: "relative",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 32,
            paddingBottom: 28,
            borderBottom: "1px solid rgba(236,229,216,.12)",
            animation: "riteFade .7s ease both",
          }}
        >
          <div style={{ maxWidth: 720 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: ".42em", textTransform: "uppercase", color: "#d97742" }}>
              The Rite of Second Life
            </div>
            <h1 style={{ margin: "14px 0 10px", fontSize: "clamp(36px, 6vw, 68px)", lineHeight: 0.95, fontWeight: 300, letterSpacing: "-.01em" }}>
              What will you wake up as?
            </h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.55, color: "#a29a8c", maxWidth: "60ch" }}>
              Your old life is over. Choose the form your soul lands in — every species starts weak, and every species can grow into something else.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 10,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: ".18em",
              color: "#6f685e",
              whiteSpace: "nowrap",
            }}
          >
            <div>VESSELS OFFERED · {MONSTERS.length}</div>
            <div>BINDINGS REMAINING · 01</div>
            <button
              onClick={() => !bound && setI(Math.floor(Math.random() * MONSTERS.length))}
              style={{
                marginTop: 6,
                cursor: "pointer",
                background: "transparent",
                border: "1px solid rgba(217,119,66,.45)",
                color: "#d97742",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: ".24em",
                padding: "9px 14px",
                textTransform: "uppercase",
              }}
            >
              Let fate decide
            </button>
          </div>
        </header>

        <main className="rite-main">
          <section style={{ display: "flex", flexDirection: "column", gap: 2, animation: "riteFade .8s ease both" }}>
            {MONSTERS.map((m, n) => {
              const active = n === i;
              return (
                <button
                  key={m.id}
                  onClick={() => !bound && setI(n)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    width: "100%",
                    padding: "13px 16px",
                    cursor: "pointer",
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    color: "#ece5d8",
                    textAlign: "left",
                    transition: "background .22s, border-color .22s, color .22s",
                    border: "1px solid transparent",
                    borderLeft: active ? "2px solid #d97742" : "2px solid transparent",
                    background: active ? "rgba(217,119,66,.11)" : "transparent",
                    borderColor: active ? "rgba(217,119,66,.28)" : "transparent",
                  }}
                >
                  <span
                    style={{
                      width: 44,
                      height: 44,
                      flex: "none",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "50%",
                      border: `1px solid ${active ? "rgba(217,119,66,.5)" : "rgba(236,229,216,.13)"}`,
                      background: "#0d0c10",
                      fontSize: 20,
                    }}
                  >
                    {m.emoji}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 21, fontWeight: 400 }}>{m.name}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "#7d766a" }}>
                      {m.trait}
                    </span>
                  </span>
                  <span style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6f685e" }}>{m.hp}</span>
                </button>
              );
            })}
            <p
              style={{
                margin: "22px 2px 0",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                lineHeight: 1.9,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: "#575148",
              }}
            >
              ↑ ↓ to walk the circle
            </p>
          </section>

          <section
            style={{
              position: "relative",
              minHeight: 460,
              border: "1px solid rgba(236,229,216,.1)",
              background: "linear-gradient(160deg, rgba(236,229,216,.045), rgba(8,7,10,.2))",
              padding: "40px 32px",
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, width: 12, height: 12, borderTop: "1px solid #d97742", borderLeft: "1px solid #d97742" }} />
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderBottom: "1px solid #d97742", borderRight: "1px solid #d97742" }} />

            <div className="rite-detail-grid">
              <div style={{ position: "relative", width: 200, height: 200, display: "grid", placeItems: "center" }}>
                <div
                  style={{
                    position: "absolute",
                    inset: -14,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, hsl(${hue} 62% 52% / .34), transparent 68%)`,
                    filter: "blur(14px)",
                  }}
                />
                <div style={{ position: "absolute", inset: 0, border: "1px solid rgba(217,119,66,.35)", borderRadius: "50%", animation: "riteBreathe 5s ease-in-out infinite" }} />
                <div style={{ position: "absolute", inset: 10, border: "1px dashed rgba(236,229,216,.14)", borderRadius: "50%", animation: "riteSpin 52s linear infinite" }} />
                <div
                  style={{
                    position: "relative",
                    width: 168,
                    height: 168,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid rgba(236,229,216,.2)",
                    boxShadow: "inset 0 0 40px rgba(8,7,10,.9), 0 14px 40px rgba(0,0,0,.55)",
                    background: "#0d0c10",
                    fontSize: 72,
                  }}
                >
                  {s.emoji}
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: -30,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    width: 220,
                    textAlign: "center",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    letterSpacing: ".3em",
                    textTransform: "uppercase",
                    color: "#6f685e",
                  }}
                >
                  <span>
                    VESSEL {String(i + 1).padStart(2, "0")} / {MONSTERS.length}
                  </span>
                </div>
              </div>

              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: "#d97742" }}>
                  {s.trait}
                </div>
                <h2 style={{ margin: "10px 0 16px", fontSize: "clamp(32px, 4vw, 52px)", lineHeight: 1, fontWeight: 300 }}>{s.name}</h2>
                <p style={{ margin: "0 0 28px", fontSize: 18, lineHeight: 1.6, color: "#c9c1b3", maxWidth: "46ch", fontStyle: "italic", fontWeight: 300 }}>
                  {s.desc}
                </p>

                <div style={{ maxWidth: 360, borderTop: "1px solid rgba(236,229,216,.12)", paddingTop: 16, margin: "0 auto" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      letterSpacing: ".22em",
                      textTransform: "uppercase",
                      color: "#7d766a",
                    }}
                  >
                    <span>Starting HP</span>
                    <span style={{ fontSize: 14, color: "#ece5d8" }}>{s.hp}</span>
                  </div>
                  <div style={{ marginTop: 10, height: 3, background: "rgba(236,229,216,.1)" }}>
                    <div style={{ height: 3, width: `${Math.round((s.hp / 30) * 100)}%`, background: "linear-gradient(90deg, #d97742, #e8b25c)" }} />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 32, flexWrap: "wrap", justifyContent: "center" }}>
                  <button
                    onClick={accept}
                    style={{
                      cursor: "pointer",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      letterSpacing: ".22em",
                      textTransform: "uppercase",
                      padding: "15px 26px",
                      border: `1px solid ${bound ? "#e8b25c" : "#d97742"}`,
                      background: bound ? "#e8b25c" : "transparent",
                      color: bound ? "#12100e" : "#f0a877",
                      transition: "all .28s",
                    }}
                  >
                    {bound ? `Form bound · ${s.name}` : "Accept this form"}
                  </button>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      lineHeight: 1.7,
                      letterSpacing: ".16em",
                      textTransform: "uppercase",
                      color: "#575148",
                      maxWidth: "26ch",
                    }}
                  >
                    {bound ? "The circle closes. Your soul is en route." : "Once accepted, the form is bound for the whole of the second life."}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function parseReply(raw) {
  const marker = "<<STATE>>";
  const idx = raw.indexOf(marker);
  if (idx === -1) return { display: raw.trim(), state: null };
  const display = raw.slice(0, idx).trim();
  const jsonPart = raw.slice(idx + marker.length).trim();
  try {
    const state = JSON.parse(jsonPart);
    return { display, state };
  } catch (e) {
    return { display, state: null };
  }
}

function WorldEventCard({ text }) {
  return (
    <div className="w-full flex justify-center mb-4">
      <div
        className="max-w-[90%] sm:max-w-[70%] rounded-sm px-4 py-2 text-center"
        style={{
          backgroundColor: "transparent",
          border: `1px dashed ${VIOLET_SOFT}`,
          color: "#CFC4E8",
        }}
      >
        <span
          className="text-[10px] uppercase tracking-widest block mb-1"
          style={{ fontFamily: "'Courier Prime', monospace", color: VIOLET_SOFT }}
        >
          Meanwhile, elsewhere
        </span>
        <span className="text-sm italic" style={{ fontFamily: "'Newsreader', serif" }}>
          {text}
        </span>
      </div>
    </div>
  );
}

function Message({ msg, isTyping, revealCount }) {
  const isUser = msg.role === "user";
  const shown = isTyping ? msg.display.slice(0, revealCount) : msg.display;
  return (
    <div className={`w-full flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className="max-w-[85%] sm:max-w-[70%] rounded-sm px-4 py-3"
        style={
          isUser
            ? {
                backgroundColor: "#2A2620",
                color: PAPER,
                fontFamily: "'Courier Prime', monospace",
                fontSize: "0.9rem",
              }
            : {
                backgroundColor: PAPER,
                color: INK,
                fontFamily: "'Newsreader', serif",
                fontSize: "1.05rem",
                lineHeight: 1.65,
                boxShadow: "0 8px 20px -12px rgba(0,0,0,0.5)",
              }
        }
      >
        {shown}
        {isTyping && revealCount < msg.display.length && (
          <span className="inline-block ml-0.5 animate-pulse" style={{ color: INK }}>
            {"\u258C"}
          </span>
        )}
      </div>
    </div>
  );
}

function StatBar({ label, value, max, color }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[10px] uppercase tracking-wide w-8"
        style={{ fontFamily: "'Courier Prime', monospace", color: "#B7AC96" }}
      >
        {label}
      </span>
      <div className="w-20 sm:w-28 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#33291c" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px]" style={{ fontFamily: "'Courier Prime', monospace", color: "#B7AC96" }}>
        {value}/{max}
      </span>
    </div>
  );
}

function CastPanel({ characters, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: "rgba(10,8,6,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-sm p-5 sm:p-6 my-8"
        style={{ backgroundColor: DRAWER, border: `1px solid #3a2e1e` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-lg flex items-center gap-2"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: PAPER }}
          >
            <Users size={18} />
            Cast of characters
          </h3>
          <button onClick={onClose} style={{ color: PAPER }}>
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {characters.map((c, i) => (
            <div
              key={i}
              className="rounded-sm p-3"
              style={{ backgroundColor: PAPER, border: `1px solid ${PAPER_DIM}` }}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: INK }}
                >
                  {c.name}
                </span>
                <span
                  className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-sm"
                  style={{ fontFamily: "'Courier Prime', monospace", color: PAPER, backgroundColor: "#6B6152" }}
                >
                  {c.role}
                </span>
              </div>
              <p
                className="text-xs italic leading-relaxed"
                style={{ fontFamily: "'Newsreader', serif", color: "#3B3527" }}
              >
                {c.bio}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillsPanel({ skills, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: "rgba(10,8,6,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-sm p-5 sm:p-6 my-8"
        style={{ backgroundColor: DRAWER, border: `1px solid #3a2e1e` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-lg flex items-center gap-2"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: PAPER }}
          >
            <Star size={18} />
            Your skills
          </h3>
          <button onClick={onClose} style={{ color: PAPER }}>
            <X size={18} />
          </button>
        </div>
        {(!skills || skills.length === 0) ? (
          <p
            className="text-sm italic"
            style={{ fontFamily: "'Newsreader', serif", color: "#B7AC96" }}
          >
            No skills yet. They will show up here as you grow and choose new abilities.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {skills.map((s, i) => (
              <div
                key={i}
                className="rounded-sm p-3"
                style={{ backgroundColor: PAPER, border: `1px solid ${PAPER_DIM}` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: INK }}>
                    {s.name}
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-sm"
                    style={{ fontFamily: "'Courier Prime', monospace", color: PAPER, backgroundColor: VIOLET }}
                  >
                    Lv. {s.level}{s.maxLevel ? `/${s.maxLevel}` : ""}
                  </span>
                </div>
                <p
                  className="text-xs italic leading-relaxed"
                  style={{ fontFamily: "'Newsreader', serif", color: "#3B3527" }}
                >
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TraitsPanel({ traits, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: "rgba(10,8,6,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-sm p-5 sm:p-6 my-8"
        style={{ backgroundColor: DRAWER, border: `1px solid #3a2e1e` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-lg flex items-center gap-2"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: PAPER }}
          >
            <Shield size={18} />
            Your traits
          </h3>
          <button onClick={onClose} style={{ color: PAPER }}>
            <X size={18} />
          </button>
        </div>
        {(!traits || traits.length === 0) ? (
          <p
            className="text-sm italic"
            style={{ fontFamily: "'Newsreader', serif", color: "#B7AC96" }}
          >
            No traits yet. Your species should give you one or two as the story begins.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {traits.map((t, i) => (
              <div
                key={i}
                className="rounded-sm p-3"
                style={{ backgroundColor: PAPER, border: `1px solid ${PAPER_DIM}` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: INK }}>
                    {t.name}
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-sm"
                    style={{ fontFamily: "'Courier Prime', monospace", color: PAPER, backgroundColor: AMBER }}
                  >
                    Lv. {t.level}{t.maxLevel ? `/${t.maxLevel}` : ""}
                  </span>
                </div>
                <p
                  className="text-xs italic leading-relaxed"
                  style={{ fontFamily: "'Newsreader', serif", color: "#3B3527" }}
                >
                  {t.desc}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContinuePrompt({ story, onContinue, onNew, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(10,8,6,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-sm p-6"
        style={{ backgroundColor: DRAWER, border: `1px solid #3a2e1e` }}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="text-xs uppercase tracking-widest mb-2"
          style={{ fontFamily: "'Courier Prime', monospace", color: "#8A7F6A" }}
        >
          {story.genre}
        </p>
        <h3
          className="text-xl mb-3"
          style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: PAPER }}
        >
          {story.title}
        </h3>
        <p
          className="text-sm italic mb-5"
          style={{ fontFamily: "'Newsreader', serif", color: "#B7AC96" }}
        >
          You already have this story in progress. Pick up where you left off,
          or start over from the beginning?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onContinue}
            className="rounded-sm px-4 py-3 text-sm text-left"
            style={{ backgroundColor: story.accent, color: PAPER, fontFamily: "'Courier Prime', monospace" }}
          >
            Continue where I left off
          </button>
          <button
            onClick={onNew}
            className="rounded-sm px-4 py-3 text-sm text-left"
            style={{ backgroundColor: PAPER, color: INK, fontFamily: "'Courier Prime', monospace" }}
          >
            Start a new story
          </button>
        </div>
      </div>
    </div>
  );
}

function StoryView({ story, monster, characterName, onBack, resumeData }) {
  const [messages, setMessages] = useState(() => (resumeData && resumeData.messages) || []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [revealCount, setRevealCount] = useState(() =>
    resumeData && resumeData.messages && resumeData.messages.length > 0
      ? resumeData.messages[resumeData.messages.length - 1].display?.length || 0
      : 0
  );
  const [showCast, setShowCast] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showTraits, setShowTraits] = useState(false);
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [suggestedActions, setSuggestedActions] = useState(() => (resumeData && resumeData.suggestedActions) || []);
  const [gameState, setGameState] = useState(() => {
    if (resumeData && resumeData.gameState) return resumeData.gameState;
    return story.isRPG
      ? {
          hp: monster.hp,
          maxHp: monster.hp,
          mp: monster.mp,
          maxMp: monster.mp,
          level: 1,
          exp: 0,
          expToNext: monster.expToNext,
          skills: [],
          traits: [],
        }
      : null;
  });
  const [pendingChoices, setPendingChoices] = useState(() => (resumeData && resumeData.pendingChoices) || []);
  const [retryAction, setRetryAction] = useState(null);
  const scrollRef = useRef(null);
  const timerRef = useRef(null);
  const startedRef = useRef(false);
  const skipNextTypewriterRef = useRef(!!(resumeData && resumeData.messages && resumeData.messages.length > 0));
  const saveKey = saveKeyFor(story.id, characterName);

  const systemPrompt =
    typeof story.systemPrompt === "function"
      ? story.systemPrompt({ name: characterName, monster })
      : story.systemPrompt;

  async function callClaude(history) {
    // Standalone build: this calls our own backend at /api/story, which holds
    // the real (free-tier) model API key server-side. See server/index.js.
    let res;
    try {
      res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: systemPrompt,
          messages: history,
        }),
      });
    } catch (networkErr) {
      throw new Error("Could not reach the server (network error).");
    }
    let data;
    try {
      data = await res.json();
    } catch (_) {
      throw new Error(`HTTP ${res.status}`);
    }
    if (!res.ok) {
      throw new Error((data && data.error) || `HTTP ${res.status}`);
    }
    const text = (data && data.text ? data.text : "").trim();
    if (!text) throw new Error("The server returned an empty response.");
    return text;
  }

  function applyReply(raw, historyBefore) {
    const { display, state } = parseReply(raw);
    const entries = [{ role: "assistant", content: raw, display }];
    setSuggestedActions(state && Array.isArray(state.suggestedActions) ? state.suggestedActions : []);
    if (story.isRPG && state) {
      setGameState((prev) => ({
        hp: state.hp,
        maxHp: state.maxHp,
        mp: typeof state.mp === "number" ? state.mp : prev?.mp,
        maxMp: typeof state.maxMp === "number" ? state.maxMp : prev?.maxMp,
        level: state.level,
        exp: state.exp,
        expToNext: state.expToNext,
        skills: Array.isArray(state.skills) ? state.skills : prev?.skills || [],
        traits: Array.isArray(state.traits) ? state.traits : prev?.traits || [],
      }));
      setPendingChoices(Array.isArray(state.levelUpOptions) ? state.levelUpOptions : []);
      if (state.worldEvent) {
        entries.push({ role: "event", content: state.worldEvent, display: state.worldEvent });
      }
    }
    setMessages([...historyBefore, ...entries]);
  }

  async function begin() {
    setLoading(true);
    setError(null);
    try {
      const openerText = story.isRPG
        ? "Begin the story now. Narrate the disorienting moment of waking up in this new body for the first time, right after death, and put me directly into the action. Do not ask questions outright — end at a natural moment where I would act."
        : "Begin the story now. Set the scene vividly and put me directly into the action. Do not ask questions outright — end at a natural moment where I would act.";
      const opener = [{ role: "user", content: openerText }];
      const raw = await callClaude(opener);
      applyReply(raw, opener);
      setRetryAction(null);
    } catch (e) {
      setError(`The story would not begin — ${e.message}`);
      setRetryAction(() => begin);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      if (messages.length === 0) {
        begin();
      }
    }
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (!skipNextTypewriterRef.current) {
      clearInterval(timerRef.current);
      setRevealCount(0);
      const full = last.display;
      timerRef.current = setInterval(() => {
        setRevealCount((c) => {
          const next = c + 3;
          if (next >= full.length) {
            clearInterval(timerRef.current);
            return full.length;
          }
          return next;
        });
      }, 12);
    }
    skipNextTypewriterRef.current = false;
    return () => clearInterval(timerRef.current);
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, revealCount, loading]);

  useEffect(() => {
    if (messages.length === 0) return;
    let cancelled = false;
    (async () => {
      const ok = await writeSave(saveKey, {
        monsterId: monster ? monster.id : null,
        characterName,
        messages,
        gameState,
        pendingChoices,
        suggestedActions,
        updatedAt: Date.now(),
      });
      if (!cancelled) setSaveStatus(ok ? "saved" : "error");
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, gameState, pendingChoices, suggestedActions, saveKey, monster, characterName]);

  async function handleRestart() {
    await deleteSave(saveKey);
    onBack();
  }

  async function attemptTurn(withUser) {
    setLoading(true);
    setError(null);
    try {
      const apiMessages = withUser
        .filter((m) => m.role !== "event")
        .map((m) => ({ role: m.role, content: m.content }));
      const raw = await callClaude(apiMessages);
      applyReply(raw, withUser);
      setRetryAction(null);
    } catch (e) {
      setError(`The page stuck to the typewriter ribbon — ${e.message}`);
      setRetryAction(() => () => attemptTurn(withUser));
    } finally {
      setLoading(false);
    }
  }

  async function sendUserTurn(text) {
    if (!text.trim() || loading) return;
    const withUser = [...messages, { role: "user", content: text, display: text }];
    setMessages(withUser);
    setInput("");
    setPendingChoices([]);
    setSuggestedActions([]);
    await attemptTurn(withUser);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendUserTurn(input);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: NIGHT }}>
      <GoogleFonts />
      {showCast && story.characters && (
        <CastPanel characters={story.characters} onClose={() => setShowCast(false)} />
      )}
      {showSkills && story.isRPG && (
        <SkillsPanel skills={gameState?.skills} onClose={() => setShowSkills(false)} />
      )}
      {showTraits && story.isRPG && (
        <TraitsPanel traits={gameState?.traits} onClose={() => setShowTraits(false)} />
      )}
      <div
        className="flex flex-col gap-3 px-4 sm:px-8 py-4"
        style={{ borderBottom: `1px solid #33291c`, backgroundColor: DRAWER }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-sm"
              style={{ fontFamily: "'Courier Prime', monospace", color: PAPER }}
            >
              <ArrowLeft size={16} />
              Archive
            </button>
            {story.characters && (
              <button
                onClick={() => setShowCast(true)}
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-sm"
                style={{ fontFamily: "'Courier Prime', monospace", color: PAPER }}
              >
                <Users size={16} />
                Cast
              </button>
            )}
            {story.isRPG && (
              <button
                onClick={() => setShowSkills(true)}
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-sm"
                style={{ fontFamily: "'Courier Prime', monospace", color: PAPER }}
              >
                <Star size={16} />
                Skills
              </button>
            )}
            {story.isRPG && (
              <button
                onClick={() => setShowTraits(true)}
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-sm"
                style={{ fontFamily: "'Courier Prime', monospace", color: PAPER }}
              >
                <Shield size={16} />
                Traits
              </button>
            )}
            {confirmingRestart ? (
              <span className="flex items-center gap-2 text-xs px-2" style={{ fontFamily: "'Courier Prime', monospace" }}>
                <span style={{ color: "#E4C9C9" }}>Restart story?</span>
                <button onClick={handleRestart} style={{ color: "#E4C9C9", textDecoration: "underline" }}>
                  Yes
                </button>
                <button onClick={() => setConfirmingRestart(false)} style={{ color: PAPER, textDecoration: "underline" }}>
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmingRestart(true)}
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-sm"
                style={{ fontFamily: "'Courier Prime', monospace", color: PAPER }}
              >
                <RotateCcw size={16} />
                Restart
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {story.isRPG && (
              <span className="text-xl" title={monster.name}>
                {monster.emoji}
              </span>
            )}
            <span
              className="text-xs uppercase tracking-widest px-2 py-1 rounded-sm"
              style={{
                fontFamily: "'Courier Prime', monospace",
                color: PAPER,
                backgroundColor: story.accent,
                letterSpacing: "0.12em",
              }}
            >
              {story.genre}
            </span>
            <h2
              className="hidden sm:block text-lg"
              style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: PAPER }}
            >
              {story.title}
            </h2>
          </div>
        </div>
        {saveStatus === "error" && (
          <p
            className="text-[11px]"
            style={{ fontFamily: "'Courier Prime', monospace", color: "#E4A9A9" }}
          >
            Autosave isn't working right now — your progress may not be saved if you leave.
          </p>
        )}
        {story.isRPG && gameState && (
          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <span
              className="text-xs px-2 py-1 rounded-sm"
              style={{ fontFamily: "'Courier Prime', monospace", color: PAPER, backgroundColor: VIOLET }}
            >
              Lv. {gameState.level}
            </span>
            <StatBar label="HP" value={gameState.hp} max={gameState.maxHp} color={GREEN} />
            <StatBar label="MP" value={gameState.mp} max={gameState.maxMp} color={BLUE} />
            <StatBar label="EXP" value={gameState.exp} max={gameState.expToNext} color={VIOLET_SOFT} />
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-2xl mx-auto">
          <p
            className="text-xs uppercase tracking-widest mb-6 text-center"
            style={{ fontFamily: "'Courier Prime', monospace", color: "#8A7F6A" }}
          >
            You are{characterName ? ` ${characterName}, ` : " "}
            {story.isRPG ? `a ${monster.name}` : story.role}
          </p>
          {messages.map((msg, i) =>
            msg.role === "event" ? (
              <WorldEventCard key={i} text={msg.display} />
            ) : (
              <Message
                key={i}
                msg={msg}
                isTyping={i === messages.length - 1 && msg.role === "assistant"}
                revealCount={revealCount}
              />
            )
          )}
          {loading && (
            <div className="w-full flex justify-start mb-4">
              <div
                className="rounded-sm px-4 py-3 flex items-center gap-2"
                style={{ backgroundColor: PAPER, color: INK_SOFT }}
              >
                <Loader2 size={16} className="animate-spin" />
                <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: "0.8rem" }}>
                  writing...
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="w-full flex justify-center mb-4">
              <div
                className="rounded-sm px-4 py-3 text-sm flex flex-col sm:flex-row items-center gap-3"
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  color: "#E4C9C9",
                  backgroundColor: "#3A2323",
                }}
              >
                <span>{error}</span>
                {retryAction && (
                  <button
                    onClick={() => retryAction()}
                    className="px-3 py-1 rounded-sm text-xs uppercase tracking-wide whitespace-nowrap"
                    style={{ backgroundColor: "#E4C9C9", color: "#3A2323" }}
                  >
                    Try again
                  </button>
                )}
              </div>
            </div>
          )}
          {pendingChoices.length > 0 && !loading && (
            <div
              className="rounded-sm p-4 mb-4"
              style={{ backgroundColor: "#2A2140", border: `1px solid ${VIOLET_SOFT}` }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} style={{ color: VIOLET_SOFT }} />
                <span
                  className="text-xs uppercase tracking-widest"
                  style={{ fontFamily: "'Courier Prime', monospace", color: "#CFC4E8" }}
                >
                  Choose your growth
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {pendingChoices.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => sendUserTurn(`For my growth, I choose: ${opt}`)}
                    className="text-left rounded-sm px-3 py-2 text-sm transition-colors"
                    style={{ backgroundColor: PAPER, color: INK, fontFamily: "'Newsreader', serif" }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}
          {pendingChoices.length === 0 && suggestedActions.length > 0 && !loading && (
            <div className="flex flex-wrap gap-2 mb-4">
              {suggestedActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => sendUserTurn(action)}
                  className="text-left rounded-sm px-3 py-2 text-xs transition-colors"
                  style={{
                    backgroundColor: "transparent",
                    color: PAPER,
                    border: `1px dashed ${INK_SOFT}`,
                    fontFamily: "'Courier Prime', monospace",
                  }}
                >
                  {action}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-8 py-4" style={{ borderTop: `1px solid #33291c`, backgroundColor: DRAWER }}>
        <div className="max-w-2xl mx-auto flex items-end gap-3">
          <div
            className="flex-1 flex items-center gap-2 rounded-sm px-3 py-2"
            style={{ backgroundColor: PAPER, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }}
          >
            <PenLine size={16} style={{ color: INK_SOFT, flexShrink: 0 }} />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Say or do something as your character..."
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm py-1"
              style={{ fontFamily: "'Courier Prime', monospace", color: INK }}
            />
          </div>
          <button
            onClick={() => sendUserTurn(input)}
            disabled={loading || !input.trim()}
            className="flex items-center justify-center rounded-sm px-4 py-3 transition-opacity disabled:opacity-40"
            style={{ backgroundColor: story.accent, color: PAPER }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function NameEntry({ story, monster, defaultName, onSubmit, onBack }) {
  const [name, setName] = useState(defaultName || "");
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-10"
      style={{ backgroundColor: NIGHT }}
    >
      <GoogleFonts />
      <div className="w-full max-w-md">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm px-3 py-2 mb-6 rounded-sm"
          style={{ fontFamily: "'Courier Prime', monospace", color: PAPER }}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="text-center mb-8">
          <p
            className="text-xs uppercase tracking-[0.3em] mb-3"
            style={{ fontFamily: "'Courier Prime', monospace", color: "#8A7F6A" }}
          >
            {story.genre}
          </p>
          <h1
            className="text-3xl sm:text-4xl mb-3"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: PAPER }}
          >
            What's your name?
          </h1>
          <p
            className="text-sm sm:text-base"
            style={{ fontFamily: "'Newsreader', serif", color: "#B7AC96", fontStyle: "italic" }}
          >
            {story.isRPG && monster
              ? `Other characters in Veyloria will call you this, ${monster.name.toLowerCase()} or not.`
              : "Other characters in the story will call you by this name."}
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onSubmit(name.trim());
          }}
          className="flex flex-col gap-3"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter a name..."
            maxLength={40}
            className="rounded-sm px-4 py-3 text-lg outline-none"
            style={{ backgroundColor: PAPER, color: INK, fontFamily: "'Newsreader', serif" }}
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-sm px-4 py-3 text-sm uppercase tracking-wide disabled:opacity-40"
            style={{ backgroundColor: story.accent, color: PAPER, fontFamily: "'Courier Prime', monospace" }}
          >
            Begin
          </button>
        </form>
      </div>
    </div>
  );
}

export default function StoryArchiveApp() {
  const [selected, setSelected] = useState(null);
  const [monster, setMonster] = useState(null);
  const [characterName, setCharacterName] = useState("");
  const [stage, setStage] = useState("archive");
  const [saveHints, setSaveHints] = useState({}); // storyId -> { name, hasSave }
  const [pendingContinue, setPendingContinue] = useState(null); // { story, name, save }
  const [resumeData, setResumeData] = useState(null);

  async function refreshSaveHints() {
    const results = {};
    for (const s of STORIES) {
      const lastName = getLastName(s.id);
      if (!lastName) continue;
      const save = await loadSave(saveKeyFor(s.id, lastName));
      if (save) results[s.id] = { name: lastName, hasSave: true };
    }
    setSaveHints(results);
  }

  useEffect(() => {
    refreshSaveHints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChooseStory(story) {
    setSelected(story);
    setResumeData(null);
    setMonster(null);
    if (story.isRPG) {
      setStage("select-monster");
    } else {
      setStage("enter-name");
    }
  }

  function handleChooseMonster(m) {
    setMonster(m);
    setStage("enter-name");
  }

  async function handleNameSubmit(name) {
    const key = saveKeyFor(selected.id, name);
    const existing = await loadSave(key);
    if (existing) {
      setPendingContinue({ story: selected, name, save: existing });
    } else {
      beginWithName(selected, name, null);
    }
  }

  function beginWithName(story, name, save) {
    setCharacterName(name);
    setLastName(story.id, name);
    if (save) {
      if (story.isRPG) {
        const m = MONSTERS.find((mm) => mm.id === save.monsterId) || monster || MONSTERS[0];
        setMonster(m);
      }
      setResumeData(save);
    } else {
      setResumeData(null);
    }
    setStage("story");
    setPendingContinue(null);
  }

  async function handleStartNewForName(story, name) {
    await deleteSave(saveKeyFor(story.id, name));
    beginWithName(story, name, null);
  }

  function handleBackToArchive() {
    setSelected(null);
    setMonster(null);
    setResumeData(null);
    setCharacterName("");
    setStage("archive");
    refreshSaveHints();
  }

  if (stage === "archive")
    return <Archive onChoose={handleChooseStory} saves={saveHints} />;

  if (stage === "select-monster")
    return <MonsterSelect story={selected} onChoose={handleChooseMonster} onBack={handleBackToArchive} />;

  if (stage === "enter-name")
    return (
      <>
        <NameEntry
          story={selected}
          monster={monster}
          defaultName={getLastName(selected.id)}
          onSubmit={handleNameSubmit}
          onBack={handleBackToArchive}
        />
        {pendingContinue && (
          <ContinuePrompt
            story={pendingContinue.story}
            onContinue={() => beginWithName(pendingContinue.story, pendingContinue.name, pendingContinue.save)}
            onNew={() => handleStartNewForName(pendingContinue.story, pendingContinue.name)}
            onClose={() => setPendingContinue(null)}
          />
        )}
      </>
    );

  return (
    <StoryView
      story={selected}
      monster={monster}
      characterName={characterName}
      onBack={handleBackToArchive}
      resumeData={resumeData}
    />
  );
}
