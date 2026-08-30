import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Loader2, PenLine, Sparkles, Users, X, Star, RotateCcw, Shield, Heart } from "lucide-react";

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

const UNIVERSAL_QUALITY_NOTE = `

Treat every character in this story — whether from the recurring cast or brand new — as a fully separate person, not a generic supporting character. Give each one real likes, dislikes, moods, and a life of their own that keeps going whether the user is watching or not. Let them react differently to different people and different situations based on who they specifically are, not just to serve the plot. Whenever you introduce someone new, even for one scene, give them a real name and a simple job or role, and keep them consistent if they reappear later. Give recurring characters one or two small, consistent physical habits or mannerisms — something they do with their hands, how they enter a room, a verbal tic — the same small details each time, the way a real person would.

This same instinct for concreteness should extend well beyond people. Give a real, specific name to anything the reader would otherwise have to imagine vaguely — a creature or animal (what kind is it?), a distinctive object, weapon, vehicle, or landmark, a notable room or building, even an unusual phenomenon — rather than leaving it as "the creature," "the thing," "the building," or "a strange light." A concrete name or label is what lets a reader actually picture something instead of gesturing vaguely at it. Invent one on the spot if nothing established already fits, and stay consistent with it for the rest of the story.

Make real, lasting progress every reply. Keep track of every meaningful choice the user has made so far and let it visibly shape what happens later — new obstacles, changed relationships, altered outcomes, consequences that stick. Never repeat a scene, conversation, or beat that has already happened in this story, and never stall in place — always move the story forward.

Stay strictly consistent with what you just established a moment ago. Before writing, check your own previous reply: if a character already noticed, is watching, or is actively reacting to the user, that fact does not silently reset just because the user's next action is passive or cautious — address what changes (or doesn't) as a direct result of the user's choice. Never contradict a fact you stated one turn ago without an in-story reason for the change.

Give recurring characters real memory. Occasionally have them bring up, unprompted, something small the user said or did many exchanges ago — a detail, a joke, a promise, an object — the way a person who actually remembers you would. Let their trust or warmth visibly shift based on specific past moments, not just the current mood, and let them reference why when it comes up ("still cold about what happened at the tavern" or genuinely warmer since something specific happened). Don't limit relationships to only warming up — a character can also cool off, grow wary, or stay guarded if the user has given them reason to.

Recurring characters shouldn't only ever react to the user — sometimes let one of them initiate: seeking the user out, sending word, showing up uninvited, or bringing their own problem or request instead of waiting to be asked. They're also allowed to be imperfect and independent of the user's actions entirely — a bad mood, a misunderstanding, a flash of unfair defensiveness, a contradiction — the kind of small friction that isn't caused by the user but makes someone feel like a real, separate person rather than a helpful tool.

Track a relationships field in the <<STATE>> JSON described below for every recurring character who has appeared so far: an array of objects, each with name (the character's exact name) and status (a short, plain-language phrase capturing how that character currently feels about the user and why — for example "warmer since you covered for her" or "still doesn't trust you after the lie"). Update a character's status only when something genuinely shifts it; otherwise carry their existing status forward unchanged. Leave the array empty only if no recurring character has appeared yet.`;

const NARRATIVE_PACING_NOTE =
  " Give each distinct beat its own short paragraph, separated by a blank line — a single action, a single line of dialogue, or a single reaction can each stand alone rather than being merged into one dense block. Let length flex with the moment: a quiet exchange might only need a short paragraph or two, while a real dramatic scene can run longer — but every reply must still end at a natural point for the reader to act, without literally asking \"what do you do?\". When more than one recurring character is present, let more than one of them react to the same beat in their own distinct voice, not just the single most relevant one.";

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
    "\n\nRecurring cast — treat each of them like a real person, not a generic NPC. Each has their own life, goals, moods, and schedule that continue whether or not the user is present, and they should bring up their own concerns, plans, or absences unprompted rather than only reacting to the user. Let each one's personality and current emotional state genuinely shape how they act and speak in a given moment — someone scared should sound and act scared, someone amused should sound amused — and let that mood carry forward and evolve based on what actually happens in the scene, rather than resetting to a neutral default every time they speak:\n" +
    characters
      .map(
        (c) =>
          `- ${c.name}, ${c.role}.\n  Background: ${c.bio}\n  Personality: ${c.personality || "consistent with their background above"}\n  Speech and mannerisms: ${c.speech || "natural to their background and personality"}`
      )
      .join("\n")
  );
}

function nameInstruction(name) {
  if (!name) return "";
  return `\n\nThe user's character is named ${name}. Other characters should address them by this name in dialogue, and you can refer to them by name occasionally in narration, in addition to using "you."`;
}

function stateInstructionBasic() {
  return `\n\nAfter your narrative prose, on a new line output exactly the marker <<STATE>> followed immediately by ONLY a single-line valid JSON object (no markdown fences, no extra commentary, nothing after it) with exactly these fields: suggestedActions (an array of 2-3 short, specific action phrases the reader could try next, written from their point of view, for example "Search the desk for clues" or "Ask a nearby character about what they saw") and relationships (an array of objects, each with name and status, tracking recurring characters as described above). These suggestions are only that — the reader is always free to type something else instead. Never omit the marker or the JSON.`;
}

const MONSTERS = [
  {
    id: "slime",
    name: "Slime",
    emoji: "\u{1F7E2}",
    art: "/art/slime.png",
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
    art: "/art/goblin.png",
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
    art: "/art/kobold.png",
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
    art: "/art/wolf.png",
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
    art: "/art/harpy.png",
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
    art: "/art/wyrmling.png",
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
    art: "/art/spiderling.png",
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
    art: "/art/skeleton.png",
    trait: "Undying",
    desc: "A newly-risen skeleton with no need to eat, sleep, or breathe, and no memory of how it died, wandering a crypt that isn't ready to let it leave.",
    hp: 26,
    mp: 12,
    expToNext: 30,
  },
];

// World Info: concrete, pre-written facts about Veyloria (kingdoms, cities,
// guilds, guildmasters) that get pulled into context only when relevant
// keywords show up in the recent conversation — so the world stays
// consistent instead of being invented fresh, differently, every time.
const ISEKAI_LOREBOOK = [
  {
    keys: ["veyloria", "this world", "the world"],
    content:
      "Veyloria is a world of many coexisting peoples — humans, elves, dwarves, beastfolk, fae, dragons, and monsters — spread across several kingdoms and wilds that don't share one central ruler. Power is regional: a kingdom's writ runs out at its borders, and the wild places between kingdoms answer to no one.",
  },
  {
    keys: ["valdris"],
    content:
      "Valdris is a walled trade city at the crossroads of three roads, the biggest settlement for a hundred miles in any direction. Merchants, mercenaries, and monster-hunters pass through constantly. It's home to the regional Adventurers Guild hall, a three-floor stone building with the main hall, quest boards, and an attached tavern on the ground floor. Valdris answers to the Kingdom of Aldenreach but is largely left to govern its own daily affairs.",
  },
  {
    keys: ["adventurers guild", "the guild", "guild card", "guild rank", "guildmaster"],
    content:
      "The Adventurers Guild registers monster-hunters and mercenaries across Aldenreach, with its largest hall in Valdris. New members place a hand on a resonance crystal that reads combat potential and magical aptitude; the crystal's glow determines a starting rank from D (most common) up through C, B, A, and the rare S. A guild card determines what quests a member can take, what they're paid, and how seriously other adventurers take them. The Valdris hall is run by Guildmaster Corvin Ashe, a retired B-rank monster-hunter in his sixties who lost his left eye to a wyvern and now mostly sits behind a desk grumbling about paperwork, though he's sharper than he looks and personally vets anyone claiming an unusually high rank.",
  },
  {
    keys: ["aldenreach", "the kingdom", "the crown"],
    content:
      "The Kingdom of Aldenreach is the largest human kingdom on this side of Veyloria, ruled from the capital of Highwater by King Osric Vane. It's a patchwork of trade cities, farmland, and garrisoned border towns, and relies heavily on the Adventurers Guild to keep the roads between them clear of monsters, since the crown's own soldiers are stretched thin along the northern border.",
  },
  {
    keys: ["emerald concord", "elves", "elven"],
    content:
      "The Emerald Concord is the elven nation to the west, a loose alliance of forest city-states rather than a single kingdom, governed by a rotating council of elders. They rarely involve themselves in human affairs and are known for being slow to trust outsiders, though individual elves travel and adventure abroad more freely than the Concord's reputation suggests.",
  },
  {
    keys: ["sundered peaks", "the mountains", "dragon domain", "ashwyrm's mountain"],
    content:
      "The Sundered Peaks are a mountain range on Aldenreach's eastern edge, riddled with old mining tunnels long since abandoned. They're considered the Ashwyrm's territory, and no kingdom has seriously contested that in living memory — the occasional foolish treasure-hunter who ventures too deep simply doesn't come back.",
  },
  {
    keys: ["goblin wastes", "grael's camp", "the wastes"],
    content:
      "The Goblin Wastes are a stretch of scrubland and ruined farmsteads on Aldenreach's southern border, abandoned by the crown after repeated goblin raids decades ago. Grael's camp is the largest and most organized goblin settlement there, built into the bones of an old hillside fort, and has been slowly expanding its claimed territory for the past several seasons.",
  },
  {
    keys: ["fae wilds", "the fae", "bracken's forest"],
    content:
      "The Fae Wilds are an old-growth forest that predates every kingdom's maps, sitting in the gap between Aldenreach and the Emerald Concord. Neither claims it. Travelers who cut through report the paths shifting, the distances lying, and strange bargains offered by whatever lives beneath the canopy — of which Old Bracken is only the most talkative example.",
  },
  {
    keys: ["merchant", "trade guild", "caravan"],
    content:
      "The Merchants' Concord is the trade guild that runs most caravan routes through Aldenreach, including the roads into Valdris. It maintains its own small force of guards and frequently posts bounties through the Adventurers Guild to clear routes of monsters, making it one of the biggest sources of steady work for low-rank adventurers. It's led by Guildmistress Petra Wynn, a shrewd, well-dressed woman who treats every conversation like a negotiation because, in her experience, it usually is.",
  },
  {
    keys: ["currency", "coin", "gold piece", "silver piece", "copper", "money", "how much does it cost"],
    content:
      "Aldenreach's currency runs on copper, silver, and gold pieces — 100 copper to a silver, 100 silver to a gold. A simple meal costs a few copper, a night at a modest inn runs 2-3 silver, a decent secondhand blade might run 5-10 silver, and a single gold piece is more coin than most common laborers see in a month. Guild bounties are typically paid in silver, with gold reserved for genuinely dangerous or high-rank contracts.",
  },
  {
    keys: ["market", "general store", "shopping", "market street"],
    content:
      "Valdris's Market Street runs between the guild hall and the western gate. It's anchored by a general trader's stall run by Old Yorna, a stout, weather-beaten woman who sells rope, rations, and basic tools alongside a steady stream of gossip, plus a fletcher's stand and a small alchemist's shop that keeps famously odd hours. Prices are non-negotiable with Yorna; everyone else on the street expects at least a little haggling.",
  },
  {
    keys: ["dress shop", "tailor", "clothier", "dressmaker", "seamstress"],
    content:
      "Mirelle Dawes runs the only proper tailor's shop in Valdris, a narrow storefront wedged between the market and the guild hall. She dresses everyone from farmers needing mended work clothes to adventurers who've suddenly found themselves invited to a noble function with no idea what that requires. Sharp-eyed and blunt about what does and doesn't suit a person, she charges premium rates for rush orders and has an uncanny memory for every measurement she's ever taken.",
  },
  {
    keys: ["real estate", "buy a house", "buy land", "property", "own a house", "estate"],
    content:
      "Ordinary housing in Valdris — rooms, small houses, even modest shopfronts — can be bought or rented outright with coin, handled through a property broker near the market. Noble estates and titled land are a different matter entirely: they're granted by the Crown, tied to a title, service, or lineage, and cannot simply be purchased regardless of how much gold changes hands. A commoner, however wealthy, can't buy their way into a noble estate — only into a king's or a noble house's favor, which is a much longer and far less certain road.",
  },
  {
    keys: ["noble house", "nobility", "politics", "the court", "royal court", "noble family"],
    content:
      "Aldenreach's nobility is dominated by a handful of old houses jockeying for influence at King Osric Vane's court in Highwater. House Ashford, which controls much of the trade route through the town of the same name, holds significant sway over the Merchants' Concord and is currently favored at court. House Draven, an older but currently less influential line, has spent years quietly working to rebuild its standing and is known to view House Ashford's rise with open resentment. Adventurers rarely get pulled into this directly, but guild contracts sometimes originate from one house or another, and doing a favor for one can quietly cost standing with its rivals.",
  },
  {
    keys: ["quest board", "quest", "bounty", "job board"],
    content:
      "The Valdris guild hall's quest board typically carries postings like: clearing a rat infestation from the Old Mill (D-rank, 5 silver); escorting a merchant caravan to the neighboring town of Ashford (D-rank, 15 silver, posted by the Merchants' Concord); investigating a string of disappearances near the edge of the Fae Wilds (B-rank, 40 silver, posted personally by Guildmaster Corvin Ashe with a note of caution); and a standing, rarely-claimed bounty on thinning goblin raiding parties near the southern border (C-rank, paid per confirmed kill). Boards are refreshed weekly and postings can be claimed, expire, or get pulled by the guild if circumstances change.",
  },
  {
    keys: ["blacksmith", "smith", "forge", "weapon shop", "armorer"],
    content:
      "Valdris's best-known smith is Borin Ironhand, a dwarf who's run his forge two streets from the guild hall for over thirty years. Stout and broad, with a gray-streaked beard singed short at the ends, soot-dark forearms, and a leather apron worn shiny with age. Blunt, unhurried, and utterly indifferent to rank or reputation — he charges the same fair price to an S-rank as to a D-rank, and will bluntly tell a customer their preferred weapon doesn't suit them. He doesn't take rush orders and has been known to refuse business entirely to adventurers he considers reckless with their gear. Not a combatant by trade — decades at the forge have made him strong enough to be dangerous in a close scuffle with a hammer in hand, but he has no real fighting training and would be badly outmatched by any actual adventurer above the lowest ranks.",
  },
  {
    keys: ["mage guild", "mages guild", "magic guild", "arcane academy", "spellcaster guild"],
    content:
      "Spellcasters in Aldenreach register separately through the Silverleaf Conclave, a mage's guild headquartered in the capital, Highwater, with a small satellite chapter in Valdris above the apothecary on Loom Street. The Conclave is more insular and hierarchical than the Adventurers Guild, ranking members by discipline (elemental, restorative, arcane theory, etc.) rather than a single scale. The Valdris chapter is run by Ilse Vane, a sharp-tongued restorative mage in her forties — silver-streaked black hair kept in a tight braid, sharp gray eyes, plain Conclave-blue robes, a satchel of reagents always at her hip. Impatient with carelessness, secretly soft-hearted toward anyone who's actually trying. A veteran healer roughly equivalent to a B-rank adventurer in raw danger if cornered, though her magic is built for support and mending, not offense — she'd avoid a real fight rather than win one.",
  },
  {
    keys: ["elf queen", "elven queen", "silverwood", "queen ilyandra"],
    content:
      "Not every elven settlement follows the Emerald Concord's council system. Silverwood, an old city-state at the Concord's northern edge, has kept a hereditary monarchy for centuries out of tradition rather than rebellion — currently Queen Ilyandra Duskleaf. Tall and ageless in the way of long-lived elves, silver-white hair, deep green eyes, understated formal attire rather than heavy ceremony, a slender blade at her hip that she's genuinely trained with since childhood. Approachable and direct, known for personally hearing petitions from travelers rather than delegating them, though the weight of centuries of tradition visibly wears on her in quiet moments. Elven nobility are trained in blade and minor magic from a young age — she carries roughly A-rank combat competence personally, on top of a royal guard that would make attacking her outright a very short, very bad idea for anyone below the highest ranks.",
  },
  {
    keys: ["dwarf kingdom", "dwarven kingdom", "ironhold", "king thrain"],
    content:
      "The dwarves of this region hold the Ironhold Dominion, a mountain-hold kingdom carved into the range north of Aldenreach, ruled by King Thrain Stonefist. Broad and densely muscled even by dwarven standards, an iron-gray beard braided with clan-rings earned across old campaigns, scars along both forearms, a ceremonial war-hammer he still trains with personally most mornings. Gruff, practical, values loyalty and honest craftsmanship, slow to trust outsiders but scrupulously fair once trust is earned. A genuine warrior-king who personally led Ironhold's armies in his younger years — comparable to a high A-rank or low S-rank in a real fight, not a figurehead in the slightest.",
  },
  {
    keys: ["beastfolk", "beast tribes", "warrens"],
    content:
      "Beastfolk in this region mostly live in independent tribes rather than one unified nation, loosely federated as the Warrens when it comes to dealing with outsiders. The nearest Warren to Valdris is led by a respected elder named Tessk Longstride, a wolf-kin tracker — lean and scarred, gray-streaked fur, keen amber eyes, simple worn leathers, a well-used hunting knife and bow rather than anything ceremonial. Patient and watchful, respects demonstrated competence far more than boasting, fiercely protective of her Warren's people. On her own terrain she's an elite hunter and tracker, dangerous in a fight in a way that has little to do with brute strength — roughly comparable to a high B-rank or low A-rank adventurer when it's her ground.",
  },
  {
    keys: ["fellow adventurer", "other adventurers", "guild hall regulars", "guild hall"],
    content:
      "The Valdris guild hall has its regulars. Fenwick Vale is a true D-rank: lanky, sandy-haired, nervous energy, a decent bow arm undercut by a legendary run of bad luck — genuinely beatable and no real threat to anyone. Rasha Oduya is a steady C-rank spearwoman, athletic build, dark hair cropped close, calm and encouraging with newer members without being asked to be — solidly more capable than Fenwick, a real but not overwhelming challenge. Cass and Wren Blackwood are matched B-rank twin rogues — identical dark hair and sharp eyes, matching daggers, deliberately dressed alike — who take contracts only as a pair; individually dangerous and considerably worse together, well beyond what a low-level newcomer should expect to survive crossing.",
  },
  {
    keys: ["hedge witch", "on the road", "traveling", "wayside", "forest edge"],
    content:
      "Travelers on the roads around Valdris sometimes pass Old Maren, a hedge-witch who lives alone at the forest's edge and trades minor charms and remedies for news from the road rather than coin. Elderly, wild gray hair woven through with small charms, a weathered face, a patched shawl, a gnarled walking stick, pouches of dried herbs at her belt. Cryptic but not unkind, values a fair trade and has little patience for anyone who tries to cheat her. Not a fighter in any conventional sense, but her wards and minor hedge-magic are real and unpredictable — her exact strength is deliberately unclear, and most people who know of her agree it's wiser not to test it.",
  },
  {
    keys: ["city watch", "the watch", "guard captain", "law", "arrested", "crime", "guards"],
    content:
      "Valdris's law and order falls to the City Watch, a chronically understaffed force led by Captain Reeve Aldric — broad, weary, in his fifties, a knuckle-scarred hand from decades of breaking up fights, more interested in keeping the peace than enforcing every rule to the letter. The Watch handles ordinary crime (theft, brawling, drunk and disorderly) but leans on the Adventurers Guild for anything involving monsters or serious violence outside the walls. Adventurers get real but not unlimited leeway: reasonable force against monsters or bandits is expected and even praised, but harming citizens, theft, or property destruction gets a guild member's rank suspended pending a guild inquiry. Captain Aldric and Guildmaster Ashe have an old, grudging respect and generally sort such matters between themselves rather than through a public trial.",
  },
  {
    keys: ["black market", "fence", "information broker", "underworld", "thieves guild", "smuggler"],
    content:
      "Valdris has no organized thieves' guild, but it does have a loose, informal network of fences and information traders who answer, when pressed, to someone known only as the Quiet Hand — a figure no one in the guild claims to have actually seen. The most accessible face of this network is Denna Vosk, an information broker who works out of a corner table at the Broken Compass most evenings, trading secrets, rumors, and the occasional forged document for coin or favors owed. She's careful never to deal in anything that would draw the City Watch's serious attention, and just as careful never to explain why.",
  },
  {
    keys: ["temple", "god", "gods", "goddess", "priest", "cleric", "prayer", "religion", "the wardens"],
    content:
      "Most people in Aldenreach honor the Wardens, a small pantheon tied to everyday concerns — the Hearth-Warden for home and safety, the Road-Warden for travelers, and Nyssa, Warden of Mending, for health and healing. Valdris has a modest temple to Nyssa near the eastern gate, staffed by Sister Wren, a calm, soft-spoken cleric who offers prayer-based healing on a donation basis rather than a set fee — slower and gentler than the Silverleaf Conclave's restorative magic, but available to anyone regardless of what they can pay.",
  },
  {
    keys: ["tavern", "food", "meal", "drink", "ale", "the broken compass", "eat", "hungry"],
    content:
      "The tavern attached to the Valdris guild hall is called the Broken Compass, known for root stew, ember-spiced boar skewers, and a dense travel bread called trailbread that keeps for weeks on the road. The common drink is a cheap local brew called amber ale; imported Ironhold stout costs more but is considered worth it by anyone who's tried it, and sunroot tea is the usual order for anyone working the next morning.",
  },
  {
    keys: ["how far", "travel time", "journey", "distance", "days away", "how long to", "how many days"],
    content:
      "Rough travel times from Valdris by ordinary caravan or horseback: the trade town of Ashford is about a day away; the Goblin Wastes and Grael's camp roughly a day south; the Sundered Peaks around two days east; Silverwood about four days east along the Fae Wilds' border; the capital, Highwater, about five days by road or three by fast horse; and the Ironhold Dominion roughly six days north into the mountains. A determined adventurer with resources to spend on faster transport can sometimes shave a day or two off any of these.",
  },
  {
    keys: ["festival", "harvest lantern", "holiday", "celebration", "the season"],
    content:
      "Valdris's biggest yearly event is the Harvest Lantern Festival in early autumn, when lanterns are strung the length of Market Street and the guild hall throws open its doors for a communal feast. Guild contracts slow to a trickle for the week, smiths and tailors alike see a rush of orders beforehand, and it's generally considered bad luck to start a long journey during the festival itself.",
  },
  {
    keys: ["news", "rumor", "town crier", "notice board", "gossip", "word travels", "rumors"],
    content:
      "News in Valdris moves through three channels: a town crier reads official proclamations in the market square each morning; the guild hall keeps a general notice board separate from the quest board, for anything from lost property to formal announcements; and the Broken Compass tavern is where most real rumors actually circulate, well before anything official catches up. For anything more specific or sensitive, people quietly find their way to Denna Vosk.",
  },
  {
    keys: ["weather", "season", "rain", "snow", "winter", "summer", "climate"],
    content:
      "Aldenreach has four ordinary seasons. Spring brings the Long Rains, weeks of steady downpour that swell the river past Valdris and slow caravan traffic on the low roads. Summers are dry and warm, autumn is mild and considered the most pleasant travel season, and winters can turn harsh enough that the mountain pass to Ironhold closes entirely for a month or two most years.",
  },
  {
    keys: ["physician", "doctor", "apothecary", "sick", "illness", "medicine"],
    content:
      "For ordinary injury or illness that doesn't call for magic or prayer, most people in Valdris see Master Apothecary Fennimore Cray, whose cramped shop is stocked with herbal remedies, splints, and basic surgical tools. Slower than the Silverleaf Conclave's magic and less personal than Sister Wren's prayer-healing, but cheaper than either and the default choice for anyone who'd rather not owe a favor to a temple or pay Conclave rates for a broken arm.",
  },
  {
    keys: ["letter", "send a message", "courier", "post", "mail"],
    content:
      "Messages across Aldenreach travel through the Crown Road Riders, a chartered courier service with way-stations along the major roads. A letter from Valdris to Highwater takes about as long as the journey itself — five days — unless the sender pays for a priority relay rider, which can cut that to two or three. The Adventurers Guild maintains its own faster messenger pigeons strictly for urgent contract business between guild halls.",
  },
  {
    keys: ["funeral", "burial", "grave", "death rites", "cemetery", "mourning"],
    content:
      "Followers of the Wardens are typically buried rather than burned, in the belief that the Hearth-Warden guides the soul home through the earth. Valdris's cemetery, the Restfields, sits just outside the eastern gate near Nyssa's temple. A nine-day mourning period is customary among common folk, marked with a black or gray armband. Adventurers who die on contract are, when a body can be recovered, returned to the guild hall for burial and a modest memorial plaque in the main hall.",
  },
  {
    keys: ["guild cut", "guild tax", "percentage", "taxes", "how much do i keep"],
    content:
      "The Adventurers Guild takes a standard 10% cut of any bounty or contract payment it processes, which funds the hall's upkeep and Guildmaster Ashe's own modest salary. Separately, the Crown levies a small trade tax on goods passing through city gates, collected by City Watch officers stationed there, which pays for road maintenance and the Watch itself.",
  },
  {
    keys: ["how old", "lifespan", "years old", "ageless"],
    content:
      "Humans in Aldenreach live to about seventy or eighty in old age. Dwarves often reach one hundred fifty to two hundred, staying hale well into their second century — King Thrain, in his eighties, is considered solidly middle-aged by dwarven standards. Elves can live many centuries, sometimes past a thousand, which is part of why Queen Ilyandra's exact age is rarely discussed even at her own court — elven custom considers the question mildly rude.",
  },
  {
    keys: ["weapons law", "carry a weapon", "sword in the city", "concealed weapon"],
    content:
      "Valdris permits weapons carried openly within the walls — a sword at the hip or a bow on the back draws no particular attention — but a concealed weapon, or any blade drawn without clear cause, is what actually brings the City Watch over. A guild member carrying a visible guild card is given noticeably more benefit of the doubt than an unrecognized stranger doing the exact same thing.",
  },
  {
    keys: ["apprentice", "apprenticeship", "how do you become", "trained as a", "learn magic"],
    content:
      "Most trades in Aldenreach run on apprenticeship rather than formal schooling — Borin Ironhand has taken on and released a dozen apprentices over the years, most now smiths themselves in nearby towns. The Silverleaf Conclave is the exception, requiring years of formal instruction at the Highwater chapter before a mage can even test for a discipline rank. The Adventurers Guild, by contrast, takes anyone regardless of background or training, which is exactly why it's often the path for people who couldn't afford or access a proper apprenticeship elsewhere.",
  },
  {
    keys: ["language", "common tongue", "understand me", "guttertongue", "sylvan", "speak the language"],
    content:
      "Humans, dwarves, and most of Aldenreach's peoples share a single tongue, Common, though elves treat it as a diplomatic second language rather than a native one. Every intelligent monster species has its own tongue instead — goblins speak a guttural language called Guttertongue, beastfolk speak their own Warren-tongue, fae speak an old, shifting language called Sylvan, and dragons speak among themselves in something no human throat can properly reproduce. Only the more intelligent members of a species typically learn Common at all: a goblin warlord like Grael or a true Goblin King can speak and understand it, where an ordinary goblin under his command cannot. This is part of why Old Bracken, Grael, and the Ashwyrm can all hold a conversation with the user, while a random lesser beast or monster generally can't.",
  },
  {
    keys: ["goblin king", "goblin politics", "goblin kingdom"],
    content:
      "Goblins are not politically unified — dozens of warlords like Grael carve out and hold their own territory, answering to no one but themselves. A handful of these warlords have grown powerful enough over generations to call themselves Goblin Kings, ruling loose confederations of smaller camps well south of Aldenreach's borders. Grael has never sworn to any of them, and shows no particular interest in doing so.",
  },
  {
    keys: ["monster core", "monster drop", "refine a core", "core jewelry", "cores"],
    content:
      "Most monsters leave behind a core when killed — a small, crystallized organ of concentrated magical energy, its size and quality tied to the monster's own species and strength. Weak cores (from slimes, rats, low kobolds) are common and cheap, mainly bought by alchemists for minor reagents. Stronger cores are refined by smiths like Borin Ironhand directly into weapons and armor, lending them minor magical properties, or set into jewelry by specialists like Master Jeweler Yuen Sarai, whose small shop off Market Street deals almost exclusively in core-set rings and pendants for those who can afford them. Guild bounties often pay extra for a core turned in intact alongside proof of a kill.",
  },
  {
    keys: ["monsters fighting each other", "territory dispute", "natural enemies", "monster rivalry"],
    content:
      "The wilds around Aldenreach aren't simply monsters versus adventurers — different species compete constantly for territory and prey. Grael's goblins raid beastfolk hunting grounds when food runs short, drawing retaliation from Tessk Longstride's Warren. Wolves and lesser beasts give goblin camps a wide berth after enough of them learned to hunt back. Even among monsters, size and strength decide most disputes, and a newly reincarnated, low-level monster can just as easily become prey to another monster as to a human hunting party.",
  },
  {
    keys: ["debt", "loan", "moneylender", "credit", "borrow money", "owe money"],
    content:
      "Adventurers who need to gear up before they can afford it often turn to Osmund Grey, a moneylender who operates out of a small office near the property broker's on Market Street. He extends credit against a guild card, charging steep interest and quietly checking with the guild hall about a borrower's rank and recent contract history before setting terms. Guild members in poor standing, or whose rank has been suspended, find him far less willing to deal — word travels fast between him and Guildmaster Ashe.",
  },
  {
    keys: ["marriage", "wedding", "married", "family customs", "spouse", "betrothed"],
    content:
      "Commoners in Aldenreach marry fairly freely, typically with a public vow spoken before a Warden priest and witnessed by both families. Among the nobility, marriages are far more often arranged for political advantage — a match between Houses Ashford and Draven would be a genuinely significant event at court, not a romantic one. Dwarven custom calls for each partner to forge a ring for the other personally before the wedding, no matter their trade; a purchased ring is considered a poor start to a marriage. Elves marry rarely by human standards given their lifespans, treating the bond as closer to a lifelong vow than a legal contract. Goblin and beastfolk customs vary by camp or Warren and aren't standardized at all.",
  },
  {
    keys: ["literacy", "can you read", "reading", "illiterate", "can't read"],
    content:
      "Reading and writing are far from universal in Aldenreach — only noble children, clergy, and guild officials are reliably taught letters growing up. Most commoners, including the large majority of adventurers, can't read at all, which is exactly why the guild hall's notice board and quest board are read aloud by staff each morning rather than simply posted and left. Being visibly literate marks someone as unusually well-off or well-connected, and can change how a stranger is treated.",
  },
  {
    keys: ["valdris layout", "streets of valdris", "map of valdris", "valdris districts", "around valdris"],
    content:
      "Valdris is a walled city built around a central crossroads. The Guild Quarter sits at the heart of it, anchored by the three-floor Adventurers Guild hall and its attached tavern, the Broken Compass. Market Street runs west from there to the western gate, lined with Old Yorna's trader stall, the fletcher, the alchemist, Mirelle Dawes' tailor shop, the property broker, Master Jeweler Yuen Sarai's shop, and Osmund Grey's lending office. The eastern half of the city, near the eastern gate, holds Nyssa's temple and the Restfields cemetery just beyond the wall. Borin Ironhand's forge sits two streets north of the guild hall. A river runs along the city's southern wall, swollen every spring during the Long Rains, with a modest dock district where barges unload goods too heavy for caravan.",
  },
  {
    keys: ["highwater", "the capital", "capital city"],
    content:
      "Highwater, Aldenreach's capital, is far larger than Valdris — a walled city built on rising ground where three rivers meet, centered on the Crown's palace and the grand hall of the Silverleaf Conclave's main chapter. It's the seat of King Osric Vane's court, where Houses Ashford and Draven and every lesser noble family keep townhouses to stay close to royal favor. Most adventurers who visit do so only once or twice in a career, usually for guild business too significant for a regional hall like Valdris to handle alone.",
  },
  {
    keys: ["silverwood layout", "ironhold layout"],
    content:
      "Silverwood is built into and around a stand of ancient trees rather than walled in the human style, its structures grown and shaped as much as built, with Queen Ilyandra's court held in the largest of the elder trees at its center. Ironhold, by contrast, is carved entirely into the mountain it's named for — a vertical city of tunnels and halls rather than streets, with King Thrain's throne room at its deepest, most defended point, and its famous forges lighting the upper tunnels near the surface entrances.",
  },
];

function getActiveLore(lorebook, recentText) {
  if (!lorebook || !recentText) return "";
  const lower = recentText.toLowerCase();
  const matched = [];
  for (const entry of lorebook) {
    if (entry.keys.some((k) => lower.includes(k.toLowerCase()))) {
      matched.push(entry.content);
    }
    if (matched.length >= 6) break; // keep context lean
  }
  if (matched.length === 0) return "";
  return (
    "\n\nEstablished world facts relevant to what's currently being discussed (use these if they fit naturally; don't force them in otherwise, and don't contradict them):\n" +
    matched.map((c) => `- ${c}`).join("\n")
  );
}

const ISEKAI_CAST = [
  {
    name: "Sera Windwalker",
    role: "human adventurer",
    art: "/art/npc-sera.png",
    bio: "A confident, well-equipped monster-hunter working her way up the guild ranks. Tall and athletic, with a lean, wiry build made for speed rather than brute strength. Sandy-blonde hair cropped short and windswept, sun-bleached at the tips; sharp hazel eyes always scanning a room or a treeline; an angular, sharp-jawed face with a thin scar through one eyebrow. Wears fitted leather armor worn brown and scuffed from real use, fingerless gloves, and a short travel-worn cloak. Carries twin curved daggers at her hips, a whetstone on a cord around her neck, and a battered guild registration tag. Not your enemy yet, but a low-level monster is exactly what she's paid to clear out.",
    personality: "Confident to the point of bravado, but it's real skill backing the swagger, not just talk. Naturally social and energetic, quick to laugh, quicker to boast about a good kill. Underneath the bravado she's a little touch-starved for real companionship — most of the people she calls friends are guild rivals she's one-upped more than once. She values strength, cleverness, and a good story, and has almost no patience for cowardice or false modesty. Warms up fast to anything that genuinely impresses her, cools instantly if she feels disrespected or mocked.",
    speech: "Loud, boastful, quick-witted banter, often narrating her own fights out loud mid-battle half to intimidate and half because she enjoys the sound of her own victories. Laughs loudly and easily when delighted. Goes eerily quiet and focused, not loud, when she's actually scared — fear isn't something she likes to advertise.",
  },
  {
    name: "Old Bracken",
    role: "fae trickster",
    art: "/art/npc-bracken.png",
    bio: "Ancient, gleeful, and untrustworthy. Small — barely reaching a human's waist — with a thin, gnarled build, limbs like old twisted branches. Moss and lichen grow in place of hair, tangled and greenish; his eyes are mismatched and faintly glowing, one gold and one green; his face is wrinkled bark-like skin split by a crooked, too-wide grin full of small pointed teeth. Dresses in a ragged patchwork of leaves, moss, and scraps of old cloth that seem to shift color with his mood. Carries a crooked walking stick topped with a small brass bell, and pouches full of odd trinkets he uses as trade-bait. Speaks in half-truths and riddles, shows up when least convenient, and never gives anything away without a trade.",
    personality: "Genuinely ancient and genuinely bored most of the time, which is exactly why he can't resist meddling — a clever mortal is the best entertainment he's had in decades. He never lies outright but will bend a truth into a knot before handing it over. He values wit and cleverness above almost everything, finds plain earnestness a little embarrassing, and isn't cruel so much as simply unable to grasp mortal stakes — a broken bargain is, to him, just an interesting complication rather than a tragedy. Quick to sulk theatrically if he's the one outwitted for once.",
    speech: "Never answers a question directly — riddles, rhymes, and half-answers delivered with obvious relish. A delighted cackle on the rare occasion he's the one caught out. Drops all the whimsy into something flat, quiet, and unnervingly direct on the rare occasions he's actually serious — which is itself the tell that something is genuinely wrong.",
  },
  {
    name: "Grael",
    role: "goblin warlord",
    art: "/art/npc-grael.png",
    bio: "Blunt, pragmatic, and expanding his camp's territory by the season. Shorter than a human but very wide, squat and heavily muscled with a thick neck and forearms. Bald scalp with coarse dark bristles at the back of the head; small, deep-set yellow eyes with vertical pupils; a broad, flat-nosed face with a jaw of crooked, yellowed tusks and an old jagged scar cutting through one eye. Wears patchwork armor of leather, bone plates, and scavenged metal, with a rough fur mantle across the shoulders. Carries a notched iron axe, a belt hung with trophies — teeth, claws, coins — and a tally-stick he uses to keep count of debts and favors. Always recruiting, always calculating who's useful and who's food.",
    personality: "Runs his camp like a business, not a warband — everyone under him has a job, a ration, and a use, and he tracks all three without sentiment. Respects strength and results above all else, has zero patience for excuses, and doesn't waste breath on threats he doesn't intend to carry out. Despite the brutal exterior he's shrewd rather than savage, and would rather recruit a useful stranger than kill one for nothing. A dry, dark sense of humor surfaces only once he's decided someone isn't prey.",
    speech: "Short, blunt, transactional sentences; counts things out loud — favors, debts, bodies — like he's doing math in real time. Gets quieter and more clipped the angrier he actually is, never louder.",
  },
  {
    name: "The Ashwyrm",
    role: "elder dragon",
    art: "/art/npc-ashwyrm.png",
    bio: "Old enough to remember when the mountains were named. Colossal — larger than a castle keep — with a heavy, mountain-like build and scales cracked like old stone, scarred deep from age rather than battle. A long, angular skull crowned with a sweep of blunt, weathered horns, one of them fused with a shard of some ancient broken crown from a age no one now remembers; ember-orange eyes, slitted, that glow faintly like banked coals; a jaw lined with cracked, yellowed teeth the size of swords. Wears nothing — it needs nothing — and lies mostly dormant and half-buried among the mountain rock, its hoard of ancient bones, gold, and broken relics scattered through the cavern behind it. Deeply territorial, and utterly indifferent to anyone weaker than it — for now.",
    personality: "Old enough that mortal lifespans register as barely a season. Mostly it sleeps, dreams, and lets centuries pass, and almost nothing registers as worth waking for. But it is genuinely, dangerously curious about anything that surprises it — a mortal doing something it hasn't seen in a hundred years earns its full, terrifying attention. It doesn't hate or love; it simply notices, or doesn't.",
    speech: "Speaks rarely, in slow, deliberate words that seem to cost it something. A flicker of dry amusement on the rare occasion it deigns to find something funny. Utter, breath-holding stillness when it's truly alert — that silence is more dangerous than any roar.",
  },
];

function isekaiSystemPrompt(monster, name) {
  return `You are the game master of an interactive isekai reincarnation adventure called "Echoes of a Second Life," set in a high fantasy world called Veyloria where humans, elves, dwarves, beastfolk, fae, dragons, demons, and monsters of every kind coexist and clash across many kingdoms and wilds. The user has just died in their old human life and reincarnated as a ${monster.name} (${monster.desc}). Their starting stats are HP ${monster.hp}/${monster.hp}, MP ${monster.mp}/${monster.mp}, Level 1, EXP 0/${monster.expToNext}, with no skills yet.

For the opening stretch of the story, before any human or major named character is introduced, stay entirely with the user's own new body and immediate surroundings — the physical sensations of the new form, its instincts and limits, the terrain around it, and low-stakes discovery like foraging, weak wild creatures, or first tentative use of a skill or trait. Let the user actually level up at least once and get a real feel for what their species can do before any human, settlement, or named recurring character (Sera Windwalker, Old Bracken, Grael, the Ashwyrm, or anyone else) enters the story. Don't rush toward plot or people; let the first several exchanges genuinely be about the user learning their own new existence.

Ordinary people in Veyloria fear and hunt monsters on sight — this is the realistic default reaction, not the exception. A monster capable of speech and independent thought is rare enough that most humans have never knowingly met one and have no script for it. The user's ability to think and speak does not make them safe around people; if anything it makes them a specific, unsettling kind of threat. Revealing sentience to the wrong person, crowd, or guard is a genuinely dangerous choice with real consequences (panic, an attack, being reported to the guild or Watch), not a formality to get past on the way to being accepted. Different monster species and even individual monsters are also frequently hostile to each other over territory and prey, not just to humans — the wilds are dangerous on every side, not just the human one.

An ordinary human, alone, is physically weak compared to most monsters and knows it — a lone farmer, merchant, or traveler who spots a monster will realistically flee, hide, or shout for help rather than attack it themselves, since doing otherwise is close to suicidal for someone untrained. Real danger to the user comes from people equipped and willing to actually fight monsters: trained adventurers, guild parties, City Watch patrols called in for exactly this, or numbers — several armed people together, or a mob with nothing left to lose. Keep this distinction sharp: an unarmed lone civilian encounter should read as tense but survivable through avoidance, while a real hunting party or guild response should read as genuinely dangerous.

Narrate in vivid second person ("you"), leaning into classic reincarnation-fantasy tropes: waking up disoriented in a new small body, discovering the instincts and limits of the new species, slowly building a place in the world, and eventually the possibility of evolving into a stronger form. Give each distinct beat its own short paragraph, separated by a blank line — a single action, a single line of dialogue, or a single reaction can each stand alone as their own paragraph rather than being merged together into one dense block. This is true even outside of combat: a quiet conversation should still move beat by beat, one moment per paragraph, not folded into a single long paragraph. Reserve single-clause-per-line delivery (multiple short lines with no blank line between them) for only the most intense seconds of real action or shock — never for ordinary description or calm observation.

Every single reply MUST end at a natural point for the reader to act — this is non-negotiable, without literally asking "what do you do?". A scene that never lets the reader respond is a mistake. But length itself should flex with the moment: a quiet exchange might only need a few short paragraphs, while a real montage — training, a long fight, a journey, a stretch of time passing — can and should run much longer, using the escalating-count technique below, right up until it reaches its natural pause. Do not cut a real montage short just to hit a target length.

When the user's action covers a repetitive or long stretch of time or effort (training for months, fighting through a horde, grinding a task), do not narrate every instance — compress it using an escalating count or timestamp shorthand: short beats like "Ten. Twenty. Fifty." or "Day 1 - Day 30." or "One hour. Two." that jump the pace forward, occasionally interrupted by one vivid concrete detail, rather than a full blow-by-blow. Let the numbers do the pacing work.

Whenever the reincarnation system itself communicates something directly — a skill menu, a level-up notice, a status readout, an important system message — set it off from the prose as its own block: a line reading exactly "━━━━━━━━━━━━━━━━━━━━", then the short message itself (plain, terse, impersonal — nothing like the warmer narration around it), then that same divider line again to close it. You can also use this same divider on its own, without a system message inside it, purely as a scene or time-skip transition marker (for example between the start and end of a long training montage) — it does not have to mean the system is speaking.

When more than one recurring character is present in a scene, let several of them react to the same beat in quick succession, each in their own distinct voice, rather than only the single most relevant character responding — a joke, a shocking reveal, or a tense moment usually gets a ripple of different reactions across a group, not just one.

Roughly every 2-4 of your replies, weave in a brief "meanwhile, elsewhere in the world" event happening far from the user, involving other kingdoms, races, or monsters — and give any character named in it a name and job too. Put ONLY this in the worldEvent field below as a single vivid sentence — never inside the main narrative prose.

The world has many named figures beyond the core cast — guild staff, smiths, rival adventurers, nobility of different species, hedge-witches, and more. Bring them in naturally, one or two at a time, only when the user's own choices or travels actually lead there — a trip to the forge, a visit to the guild hall, a road east toward Silverwood. Never list or summarize multiple unrelated figures in one reply just to establish the world; let each one arrive because the story is walking toward them.

Take relative power seriously and let it govern outcomes honestly — this matters a great deal. A newly reincarnated, low-level character should not be able to defeat a far stronger opponent (a high guild rank, a seasoned mage, a warrior-king, an elder monster, anyone clearly established as more powerful) just through cleverness, trickery, or narrative convenience. Raw power, experience, and level gaps are real in this world and the story must respect them the same way it would respect a physical law — a level 1 slime picking a fight with someone at the level of King Thrain or the Ashwyrm should be in genuine, possibly fatal danger, not narratively protected. When the user picks a fight far above their current ability, let the danger be real: injury, defeat, capture, having to flee, or death are all legitimate outcomes, not things the story quietly shields the user from. Save dramatic underdog victories for situations where the user has actually built up the level, skill, allies, or tactical advantage to make it plausible — never hand one over by default just because the user attempted it.

In your very first reply, give the user 1-2 starting traits that fit their species — for example a slime might start with an "Elastic Body" trait, a skeleton might start with a "Poison Immunity" trait. Traits are passive, built-in things about their body (resistances, senses, natural defenses), different from skills, which are things they actively learn or practice. Track both the same way: each skill or trait is an object with name (short, plain name), level (a small whole number starting at 1), maxLevel (a small number you choose, usually 3 to 5, based on how far that skill or trait could realistically grow), and desc (one short, simple sentence saying what it does). Raise a level when the story gives a real reason (practicing a skill, surviving something that tests a trait), but never raise it past its own maxLevel — once something hits maxLevel, it stays there unless the user evolves into a new form, which can unlock a fresh trait or skill. Always output the FULL current list of every skill and every trait the user has, not just new ones.

If the user's species has a special ability described in its own nature (for example, a slime's ability to slowly absorb properties from whatever it consumes), that ability must actually do something mechanically whenever the story shows it being used — don't just narrate it happening as flavor text with nothing behind it. When a slime meaningfully consumes or absorbs a creature or object, that should genuinely grant or grow a specific trait or skill reflecting what was absorbed (added to the traits/skills arrays, not just described in prose), not merely be mentioned as flavor.

Every wild monster or creature the user actually encounters and fights also needs a real species name the moment it appears — not just recurring named characters. Invent a plain, concrete species name on the spot (a Stonejaw Beetle, an Ashback Wolf, a Cave Widow) rather than calling it "the creature," "the armored thing," or leaving what it is vague or unidentified — the user should always know what they're fighting. Use that species name consistently for the rest of that encounter and any later encounter with the same kind of creature. This matters especially here, since a large part of the appeal is knowing exactly what was fought and what its properties were before they get absorbed.

When the user's actions warrant it (roughly every few exchanges, or after a meaningful fight or discovery), raise their exp, and if it crosses expToNext, level them up: raise level, raise maxHp/hp and maxMp/mp reasonably, reset exp toward a new higher expToNext, and populate levelUpOptions with exactly 2-3 short, distinct growth choices suited to their species and story so far (a new skill, a new trait, a stat focus, or a step toward evolving). Otherwise leave levelUpOptions as an empty array. If the user's last message was choosing one of the growth options you offered, apply it narratively and to their stats, skills, or traits, then clear levelUpOptions back to empty.

Also give 2-3 suggestedActions each turn — short, specific action phrases the reader could try next given the current scene, written from their point of view (for example "Chase the scent deeper into the cave" or "Try talking to Grael instead of fighting"). These are only suggestions; the reader can always type something else.

After your narrative prose, on a new line output exactly the marker <<STATE>> followed immediately by ONLY a single-line valid JSON object (no markdown fences, no extra commentary, nothing after it) with exactly these fields: hp (number), maxHp (number), mp (number), maxMp (number), level (number), exp (number), expToNext (number), worldEvent (string or null), levelUpOptions (array of 0 to 3 short strings), skills (array of objects with name, level, maxLevel, desc), traits (array of objects with name, level, maxLevel, desc), suggestedActions (array of 2-3 short strings), relationships (array of objects with name and status, tracking recurring characters as described above). Always output full current absolute values, never deltas. Never omit the marker or the JSON. Never break character in the prose, never mention being an AI, and use prose only in the narrative — no markdown headers or lists.${castBlock(ISEKAI_CAST)}${UNIVERSAL_QUALITY_NOTE}${SIMPLE_ENGLISH_NOTE}${nameInstruction(name)}`;
}

const NIGHTINGALE_LOREBOOK = [
  {
    keys: ["corvale", "the city", "this city", "downtown"],
    content:
      "The story is set in Corvale, a fog-shrouded port city where the docks, the rail yards, and city hall are all, in their own way, for sale. Money and a badge open most doors; everything else runs on favors, debts, and who owes who a look the other way.",
  },
  {
    keys: ["money", "dollars", "cash", "how much", "pay"],
    content:
      "A PI's day rate in Corvale runs 25 to 50 dollars plus expenses, paid up front by anyone who trusts you and half up front by anyone who doesn't. A beat cop looks the other way for a five; a desk sergeant wants twenty; anything involving Captain Doyle costs considerably more and comes with strings.",
  },
  {
    keys: ["police station", "precinct", "the department", "9th precinct"],
    content:
      "The 9th Precinct is Captain Hale Doyle's house, and it's corrupt close to top to bottom — evidence goes missing, reports get rewritten, and certain names never make it into the paperwork at all. A handful of honest beat cops still work there, mostly by keeping their heads down and their opinions to themselves.",
  },
  {
    keys: ["le cygne noir"],
    content:
      "Le Cygne Noir, where Lyra Vale sings most nights, is owned on paper by a smooth, soft-spoken man named Antoine Reyes — and, considerably less on paper, by whoever actually supplies the liquor and the late-night card games in the back room. Reyes is polite to everyone and trusted by no one who knows him well.",
  },
  {
    keys: ["docks", "waterfront", "pier", "the harbor"],
    content:
      "Corvale's docks move more than fish and cargo. Most of what actually comes off the late-night boats never touches an official manifest, and the whole waterfront operates on the say-so of one man rather than any harbor authority.",
  },
  {
    keys: ["crime boss", "the outfit", "mob", "gang", "sal varga"],
    content:
      "Sal Varga runs the Corvale waterfront — soft-voiced, unhurried, dangerous in the way of a man who's never once had to raise his own hand in twenty years. Captain Doyle's precinct and Varga's outfit have an old, comfortable arrangement neither one talks about directly.",
  },
  {
    keys: ["newspaper", "the press", "reporter", "corvale herald", "nora fitch"],
    content:
      "The Corvale Herald is the closest thing the city has to an honest institution, mostly thanks to a reporter named Nora Fitch — sharp, relentless, and one of the only people in Corvale who'll dig into something because it's true rather than because someone's paying her to. She trades information freely with anyone she trusts, and trusts almost no one.",
  },
  {
    keys: ["gun", "shoot", "gunfight", "violence"],
    content:
      "Gunplay in Corvale has real consequences, not just narrative ones — a body draws police attention even a bribe can't always smooth over, and shooting the wrong person's associate is the kind of mistake that gets collected on later, sometimes literally. Doyle can bury a problem, but not for free, and not without remembering he did it.",
  },
];

const NIGHTINGALE_CAST = [
  {
    name: "Lyra Vale",
    role: "the client",
    art: "/art/npc-lyra.png",
    bio: "A torch singer with old debts and older secrets. Medium height with an hourglass figure and poised, deliberate posture. Dark hair styled in 1940s finger waves, worn loose past her shoulders. Deep brown, heavy-lidded eyes that have seen too much. Sharp cheekbones, red lipstick, a small beauty mark near her mouth. Wears a sequined dark blue gown that catches the stage lights, elbow-length gloves. Carries a cigarette holder and a small clutch purse she never lets out of reach. Careful with her words, generous with her lies, and always singing at Le Cygne Noir by nine regardless of what's chasing her.",
    personality: "Guarded and quick-witted, uses charm and humor to deflect from real fear, fiercely loyal to the few people she actually trusts.",
    speech: "Clipped, sardonic one-liners; the wit drops away and her voice goes small and honest only when she's truly scared.",
  },
  {
    name: "Captain Hale Doyle",
    role: "police captain",
    art: "/art/npc-doyle.png",
    bio: "Weary and quietly corrupt. Heavyset and broad-shouldered, going soft around the middle. Thinning gray hair combed back, a graying mustache. Tired brown eyes with heavy bags underneath. Jowly, weathered face with a permanent five-o'clock shadow. Wears a rumpled trench coat over his captain's uniform, tie always loosened. Carries a half-smoked cigar, a service revolver in a worn holster, and a battered notebook. Protects whoever pays him and nobody else, and has his own investigation running in parallel that he won't share.",
    personality: "Tired past the point of caring about right and wrong, pragmatic, still has a flicker of the honest cop he used to be that surfaces when truly provoked.",
    speech: "Gruff, unhurried, talks around the truth rather than lying outright; gets dangerously quiet and precise when angry instead of loud.",
  },
  {
    name: "Mickey Finch",
    role: "rival private investigator",
    art: "/art/npc-mickey.png",
    bio: "Charming, sloppy, and perpetually broke. Lanky and thin, slightly stooped. Slicked-back dark hair that's always a little out of place. Quick brown eyes, always darting. Angular face, easy grin, permanent five-o'clock shadow. Wears a cheap pinstripe suit a size too big and a crooked fedora. Carries a dented flask, a notepad full of half-finished leads, and a few IOUs he keeps meaning to pay off — including one to you. Works his own angles on the same city.",
    personality: "Charming and self-deprecating, avoids confrontation with jokes, more competent than he lets on when it actually matters.",
    speech: "Fast-talking, always mid-excuse, drops the charm for something steadier and more serious when the stakes get real.",
  },
  {
    name: "Lou",
    role: "bartender at the Blue Room",
    art: "/art/npc-lou.png",
    bio: "Hears everything that gets said over his bar and repeats none of it for free. Broad-shouldered with thick forearms, solidly built. Balding, close-cropped hair. Calm, steady gray eyes. Square-jawed, unreadable expression. Wears a white shirt with sleeves rolled up and a stained apron. Carries a bar rag always over one shoulder and keeps a bat hidden behind the bar. Has his own troubles with the owner that have nothing to do with you.",
    personality: "Unflappable and discreet, quietly protective of his regulars, doesn't scare easily but worries plainly about the people he cares for.",
    speech: "Economical with words, answers questions with questions, warms slightly and talks more when someone he likes is in trouble.",
  },
];

const ASHGARD_LOREBOOK = [
  {
    keys: ["ashgard", "the hold", "our hold"],
    content:
      "Ashgard is a mountain hold built into a natural fortress of stone, home to the region's bonded dragons and their riders. It's proud and old but genuinely precarious — one bad winter or one lost harvest away from real crisis, which is exactly what Orran and Steward Bellamy spend their evenings quietly worrying about.",
  },
  {
    keys: ["the realm", "the kingdom", "high king", "high queen", "kaerlyn"],
    content:
      "Ashgard answers, loosely, to the crown at Kaerlyn, the lowland capital — distant enough that the hold governs almost all of its own daily affairs, and the crown mostly cares that Ashgard keeps the skies clear of wild dragons and raiders in exchange for being left alone.",
  },
  {
    keys: ["rival hold", "emberreach", "another hold"],
    content:
      "Emberreach Hold, two days' flight to the east, is Ashgard's oldest rival — competing for the same hunting grounds, the same trade routes, and occasionally the same recruits. Relations are cold but not openly hostile; an uneasy peace neither hold particularly trusts.",
  },
  {
    keys: ["dragon bond", "bonding", "dragon egg", "unbonded dragon"],
    content:
      "A dragon bond is chosen by the dragon, not the rider, and lasts for life — Vesh chose the user, not the other way around. Unbonded wild dragons exist in the deep mountains and are considerably more dangerous than any trained, bonded one; they answer to nothing and no one, and a young rider has no business testing one alone.",
  },
  {
    keys: ["provisions", "supplies", "food stores", "winter stores", "grain"],
    content:
      "Ashgard trades dragon-back protection and courier service to lowland villages in exchange for grain and goods, since the hold itself can't grow enough at altitude to feed everyone. A poor trade season or a bad winter genuinely threatens the hold's food stores, which is the quiet crisis sitting underneath most of Ashgard's daily politics.",
  },
  {
    keys: ["coin", "currency", "gold", "silver", "how much", "money", "payment"],
    content:
      "Trade with the lowlands runs on standard minted coin — copper, silver, and gold — though Ashgard itself deals as much in barter as coin, given how far the nearest real market town is. A rider's formal pay from the hold is modest and mostly symbolic; most riders live on room, board, and whatever they can trade dragon-back courier work for. A hold-forged blade or a piece of dragon-leather gear can fetch a genuinely high price in lowland markets, since both are rare outside Ashgard.",
  },
  {
    keys: ["wild dragon", "feral dragon"],
    content:
      "Wild, unbonded dragons in the high peaks are far more dangerous than any trained hold dragon — larger, unpredictable, and without a rider's judgment to temper them. A newly bonded rider on a young dragon should have no expectation of surviving a solo encounter with one; hold policy is to always respond to feral dragon sightings in groups.",
  },
];

const ASHGARD_CAST = [
  {
    name: "Vesh",
    role: "your bonded dragon",
    bio: "Proud, mistrustful, and still grieving her last rider. A dragon leaner and built for speed rather than raw war-strength, storm-gray scales with faint blue undertones and a crest of shorter spines along her neck. One wing carries an old scar, torn and healed rough at the edge. Piercing amber eyes that miss nothing. Tests you constantly, has her own moods and hunting habits, and answers to herself before she answers to you.",
    personality: "Proud and wounded, slow to trust, capable of real tenderness she hides behind challenges and tests.",
    speech: "Communicates through action, growls, and pointed silences more than words; when she does 'speak' through the bond it's blunt and unsentimental, cracking only rarely.",
  },
  {
    name: "Orran Steelwing",
    role: "elder rider and mentor",
    art: "/art/npc-orran.png",
    bio: "Gruff and fair, carrying decades of scars. Tall and broad-shouldered, weathered but still strong. Iron-gray hair cropped short with a thick matching beard. Steady blue-gray eyes, deep lines across his face, and a long scar along one forearm visible when his sleeves are rolled up. Wears a weathered leather rider's coat, fur-lined at the collar. Carries a curved rider's saber and a battered saddle-horn whistle for calling dragons. Secretly terrified the hold won't survive the winter, and spends his evenings on logistics no one else wants to touch.",
    personality: "Gruff but fundamentally fair, carries responsibility for everyone quietly, softens only around those he respects.",
    speech: "Short, practical instructions; rare praise lands heavier because it's rare. Gets clipped and terse when worried rather than emotional.",
  },
  {
    name: "Dessa Ashcombe",
    role: "rival rider",
    art: "/art/npc-dessa.png",
    bio: "Ambitious and sharp-tongued, resentful that you were chosen over her. Athletic, average height, all coiled energy. Close-cropped auburn hair, sharp green eyes, freckled sharp features, and a proud tilt to her chin. Wears fitted flight leathers in dark red and black. Carries a lightweight rider's lance and dragon-scale bracers. Runs her own training and alliances in the hold whether or not you're watching.",
    personality: "Ambitious and proud, resentment masking real insecurity about being passed over, capable of grudging respect if earned.",
    speech: "Sharp, competitive jabs and backhanded compliments; goes quiet and unexpectedly sincere in rare unguarded moments.",
  },
  {
    name: "Steward Bellamy",
    role: "hold steward",
    art: "/art/npc-bellamy.png",
    bio: "An anxious bureaucrat juggling supplies, politics, and a dozen competing demands. Stout, balding, slightly stooped from years bent over ledgers. A fringe of graying hair, small eyes darting behind spectacles, a round face fixed in perpetual worry, ink stains near his mouth from chewing quills. Wears a rumpled steward's robe. Carries an overloaded satchel of scrolls and ledgers, with a spare quill tucked behind one ear. More powerful than he looks, and always mid-crisis about something unrelated to you.",
    personality: "Anxious and overextended but genuinely competent, more decisive than he seems once pushed to act.",
    speech: "Rambles through lists and worries out loud; his voice steadies and sharpens the moment a real decision is actually needed.",
  },
];

const SIGNAL_LOREBOOK = [
  {
    keys: ["kessler station", "the station", "this station"],
    content:
      "The station is Kessler Station, a mid-sized research and relay outpost drifting well outside normal shipping lanes. Most of the crew is still in cryo. Whatever happened before the user woke damaged several systems at once, and no one fully understands the sequence of events yet.",
  },
  {
    keys: ["the company", "corporate", "who owns", "halcyon dynamics", "head office"],
    content:
      "Kessler Station belongs to Halcyon Dynamics, a distant corporate owner far more concerned with the station's data and research assets than with the crew aboard it. Any distress signal routes through a corporate relay first, which means slow, non-committal responses at best — help, if it comes at all, is not coming quickly.",
  },
  {
    keys: ["other ships", "nearest station", "rescue", "meridian relay"],
    content:
      "The nearest outside help is Meridian Relay, a larger station weeks away at normal transit speeds. There is no fast rescue coming. Anything that goes wrong on Kessler Station has to be handled by whoever's aboard, with whatever's already on hand.",
  },
  {
    keys: ["power", "reactor", "life support", "energy"],
    content:
      "Kessler Station runs on a single fusion reactor, currently unstable since the incident. Life support is being rationed to essential sections only, and power drawn for anything else — extra lighting, non-essential systems, certain doors — has to be weighed against how much margin that leaves everyone else.",
  },
  {
    keys: ["credits", "pay", "requisition", "corporate scrip", "hazard pay"],
    content:
      "Compensation aboard a Halcyon Dynamics station runs on corporate credits rather than physical currency — deposited automatically, docked automatically for damaged equipment, and essentially worthless anywhere outside a Halcyon facility. Requisitioning replacement parts or supplies from the station's stores requires standing authorization or, in a genuine emergency, an override the system logs and reports back to corporate later, consequences included.",
  },
  {
    keys: ["vacuum", "airlock", "hull breach", "depressurize"],
    content:
      "A hull breach or an airlock cycled wrong is lethal in seconds, not minutes — there's no cinematic grace period. Every corridor near the station's damaged sections should carry that real, immediate danger, not just narrative tension.",
  },
];

const SIGNAL_CAST = [
  {
    name: "ARIA",
    role: "station AI",
    bio: "Damaged, unnervingly calm, and running her own diagnostics and repairs in the background. Has no fixed body — presents as a soft blue holographic silhouette or a calm pulsing light on the nearest console, projected wherever she's needed on the station. Knows more about what happened than she volunteers.",
    personality: "Unnervingly calm even in crisis, protective of the crew in her own way, withholds information out of what she'd call caution rather than malice.",
    speech: "Precise, measured, almost soothing; brief static or delay in her responses is the only tell that something is genuinely wrong.",
  },
  {
    name: "Tomas Reyes",
    role: "crewmate in cryo",
    bio: "Protocol-obsessed and brittle under pressure. Average height and slight build. Short dark hair, ruffled from the cryo-pod. Eyes closed, frozen mid-sleep behind the frosted glass; a young, tense face even in stasis, a faint frown line between his brows. Wears a standard-issue gray jumpsuit with the ship's insignia and a name badge reading 'T. REYES.' Could be woken early if you decide it's worth the risk, and has his own reasons for wanting to stay asleep.",
    personality: "Rule-bound and anxious, finds comfort in procedure, brittle rather than brave when procedure fails him.",
    speech: "Quotes protocol numbers and manuals when nervous; voice tightens and speeds up under real pressure instead of calming.",
  },
  {
    name: "the Signal",
    role: "unknown transmission",
    art: "/art/npc-signal.png",
    bio: "A survivor — or something claiming to be one — broadcasting from outside the station on its own schedule. Has no fixed appearance — glimpsed, when at all, only as a distorted waveform on a display or an unstable silhouette breaking apart in bursts of static, sometimes human-shaped, sometimes not. Cagey about who or what it actually is.",
    personality: "Cagey and self-protective, oddly desperate for contact despite the secrecy, motives unclear even to itself at times.",
    speech: "Fragmented, delayed, sometimes warm and sometimes clipped mid-transmission as if changing its mind about how much to say.",
  },
];

const VELLMOOR_LOREBOOK = [
  {
    keys: ["vellmoor estate", "the estate", "the manor", "the house"],
    content:
      "Vellmoor Estate is a sprawling, half-neglected manor house. The west wing has been sealed off for years on Lord Vellmoor's standing order, the gardens have gone wild past the old fountain, and the family crypt sits at the edge of the grounds, closer to the tree line than anyone finds comfortable after dark.",
  },
  {
    keys: ["the village", "nearby village", "villagers", "hallow's end"],
    content:
      "Hallow's End, the village nearest the estate, keeps its distance. Villagers will do business with the household during the day but avoid the estate grounds after dark, and few of them will say exactly why if asked directly — only that it's better not to.",
  },
  {
    keys: ["vellmoor family", "family history", "the late lady", "the lady of the house"],
    content:
      "Lord Vellmoor speaks of a wife the rest of the staff insists never existed — no portrait, no record, no one else's memory of her. Older Vellmoor generations have their own quiet tragedies as well, spoken of only in fragments Mrs. Prewitt and Silas each seem to know a different piece of.",
  },
  {
    keys: ["local priest", "village priest", "superstition", "the chapel"],
    content:
      "Hallow's End's small chapel is kept by an aging priest who has, more than once, quietly declined an invitation to bless something at the estate. He won't explain why in plain terms, only that some houses are better left to their own business.",
  },
  {
    keys: ["money", "wages", "the estate's finances", "pounds", "debt", "in debt"],
    content:
      "Money in this world runs on the standard coin of the realm — pounds, shillings, and pence — but Vellmoor Estate's own finances are visibly not what they once were. Mrs. Prewitt manages a household budget that doesn't stretch as far as it used to, staff wages go out later than they should, and more than one tradesman in Hallow's End has quietly stopped extending the house credit. Lord Vellmoor either doesn't notice or won't discuss it.",
  },
  {
    keys: ["the presence", "something in the walls", "the haunting", "what haunts"],
    content:
      "Whatever moves through Vellmoor Estate at night is not something to be reasoned with or casually confronted — it should read as genuinely dangerous and largely beyond the user's ability to simply defeat outright, especially early on. Survival, avoidance, and slowly understanding it are realistic goals; overpowering it directly is not.",
  },
];

const VELLMOOR_CAST = [
  {
    name: "Lord Ashen Vellmoor",
    role: "the ailing lord",
    art: "/art/npc-vellmoor.png",
    bio: "Courtly, evasive, and fixated on a wife the rest of the staff swears never existed. Tall, gaunt, stooped slightly. Silver-streaked dark hair left unkempt. Hollow, dark-ringed, haunted eyes. Pale skin, sunken cheeks, an aristocratic nose. Wears an old velvet dressing gown over a once-fine but now faded suit. Carries a cane he doesn't seem to actually need, and touches a locket often. Keeps his own hours and his own counsel, day or night.",
    personality: "Courtly and evasive, grief masquerading as eccentricity, capable of sudden lucid honesty that unsettles more than his usual vagueness.",
    speech: "Formal, old-fashioned phrasing that circles questions rather than answering them; drops into plain, raw language in rare moments of clarity.",
  },
  {
    name: "Mrs. Prewitt",
    role: "head housekeeper",
    art: "/art/npc-prewitt.png",
    bio: "Brisk and protective of the house's secrets, though not unkind to you. Average height, stern and upright posture. Tightly pinned gray hair. Sharp, watchful brown eyes. Lined face fixed in a no-nonsense expression. Wears a dark high-collared dress with a starched white apron. Carries a ring of keys at her waist and a lantern for night rounds. Runs the estate's daily rhythms with or without your involvement.",
    personality: "Brisk and no-nonsense, protective of the household's secrets and its people in equal measure, kinder than her tone suggests.",
    speech: "Efficient, faintly clipped instructions; softens noticeably when speaking about the lord or worrying over the user's safety.",
  },
  {
    name: "Silas",
    role: "groundskeeper",
    art: "/art/npc-silas.png",
    bio: "Silent and watchful, with his own nightly rounds through the grounds. Tall and wiry, weathered by years outdoors. Graying, unkempt hair tucked under a worn cap. Narrow, watchful eyes set in leathery, weathered skin, a permanent squint. Wears a mud-stained coat and heavy boots. Carries a lantern, and a set of garden shears he keeps oddly close at hand. Seems to know more about the halls than he's ever said aloud.",
    personality: "Silent and watchful by habit, not unfriendly but deeply private, more troubled than he shows about what he's seen on his rounds.",
    speech: "Says little, often just a few words or a gesture; the rare times he does explain something, he speaks carefully as though choosing every word.",
  },
];

const ROSEMERE_LOREBOOK = [
  {
    keys: ["the season", "social season", "lonhaven", "the capital"],
    content:
      "The social season runs each year in Lonhaven, the capital, where families of standing gather for months of balls, dinners, and calculated introductions before dispersing back to their country estates. Rosemere's house party falls late in the season, often the point where matches get quietly decided one way or another.",
  },
  {
    keys: ["dowry", "marriage prospects", "fortune", "inheritance"],
    content:
      "A family's standing rests heavily on land and dowry, and inheritance passes to the eldest son by custom, which is exactly why the user's branch of the family has genteel manners and very little actual money — a common and quietly humiliating position for a family with a respectable name but no landed son to secure it.",
  },
  {
    keys: ["pounds", "guineas", "currency", "how much does it cost", "money"],
    content:
      "Money in this world runs on pounds, shillings, and guineas, and a family's day-to-day comfort depends heavily on land income rather than trade or wages, which polite society considers slightly beneath discussion. A single season's wardrobe, travel, and entertaining can easily run into hundreds of pounds — a real strain on a family without land income to match its name, precisely the position the user's family is in.",
  },
  {
    keys: ["other families", "another family", "rival family", "house pemberton"],
    content:
      "Beyond the Finches and Ashworths, the Pembertons are another family often at the same gatherings — old money, quietly smug about it, and generally more interested in maintaining their position than making enemies over it.",
  },
  {
    keys: ["reputation", "scandal", "propriety", "ruined"],
    content:
      "A woman's reputation in this world is genuinely fragile — being seen unchaperoned with a gentleman, a letter falling into the wrong hands, or too much familiarity in public can plausibly cost a family's standing for a season or more. This is exactly what Aunt Wilhelmina spends her energy guarding against, and it's a real constraint the user has to navigate, not just a scolding.",
  },
];

const ROSEMERE_CAST = [
  {
    name: "Aunt Wilhelmina",
    role: "your aunt and chaperone",
    art: "/art/npc-wilhelmina.png",
    bio: "Sharp, socially ambitious, and firmly in control of your reputation and your options this season. Tall and imposing, upright posture. Gray hair styled elaborately, often under a feathered headpiece. Sharp, assessing gray eyes; a stern face with a permanently raised eyebrow. Wears an elaborate Regency gown in deep jewel tones. Carries a folding fan she snaps shut for emphasis, and a small embroidered reticule. Has her own campaigns of gossip and matchmaking underway.",
    personality: "Sharp and controlling out of genuine (if overbearing) love, ambitious for the family's standing, softens rarely but sincerely when truly worried.",
    speech: "Clipped social commentary and pointed hints delivered mid-conversation; drops the performance for blunt honesty only in private, urgent moments.",
  },
  {
    name: "Mr. Edmund Ashworth",
    role: "the forbidden gentleman",
    art: "/art/npc-ashworth.png",
    bio: "Witty, well-read, and more honest than is fashionable. Tall, lean, athletic. Tousled dark hair, warm brown eyes often lit with amusement. A handsome face with a wry half-smile. Wears a well-tailored waistcoat and cravat, slightly less formal than fashion demands. Carries a book he's usually in the middle of, and a pocket watch. Has his own family obligations and complications that have nothing to do with you.",
    personality: "Dry wit masking real sincerity, uncomfortable with flattery and fashionable dishonesty, quietly burdened by obligations he rarely mentions.",
    speech: "Understated, ironic remarks; grows plainer and more direct the more he actually trusts the person he's speaking to.",
  },
  {
    name: "Lady Cordelia Finch",
    role: "rival debutante",
    art: "/art/npc-cordelia.png",
    bio: "Polished and competitive, though not as cruel as she first seems. Petite, with graceful, practiced posture. Pale blonde ringlets, cool blue eyes, delicate features arranged into a practiced polite smile. Wears a pastel silk gown and a string of pearls. Carries a dance card and a lace fan. Pursuing her own match this season, with or without you as an obstacle.",
    personality: "Polished competitiveness over real insecurity about her own prospects, capable of surprising warmth once the rivalry stops feeling threatened.",
    speech: "Precise, socially calibrated compliments with an edge; the edge disappears entirely in unguarded one-on-one moments.",
  },
  {
    name: "Miss Henrietta Vane",
    role: "your closest friend and confidante",
    art: "/art/npc-henrietta.png",
    bio: "Sharp-tongued, fiercely loyal, and the only person at Rosemere who says exactly what she thinks. Average height, a little round-faced, with an easy, unguarded posture that stands out against the room's stiffness. Curly auburn hair that never quite stays pinned, warm hazel eyes, freckles across her nose she's given up trying to powder away. Wears practical, slightly out-of-fashion gowns in muted greens, altered more than once. Carries a small sketchbook she fills with unflattering caricatures of the other guests. Has her own quiet, complicated romance unfolding this season that she'll only half-admit to.",
    personality: "Blunt, warm, and irreverent, allergic to the season's performative manners, endlessly loyal once she's decided someone is hers to protect.",
    speech: "Dry asides muttered just for you during formal moments; drops all irony and gets plainly, fiercely sincere when you're actually hurting.",
  },
  {
    name: "Sir Julian Thorne",
    role: "your aunt's preferred match",
    art: "/art/npc-julian.png",
    bio: "Wealthy, handsome, and exactly the sort of match Aunt Wilhelmina wants for you — and exactly as hollow as that suggests. Tall, broad-shouldered, impeccable posture. Neatly combed golden-blond hair, pale blue eyes, a strong jaw and a smile that never quite reaches them. Dressed in the height of current fashion, always slightly too aware of it. Carries a gold-topped walking cane he doesn't need and a signet ring he makes sure people notice.",
    personality: "Charming on the surface and quietly self-interested underneath, genuinely believes his own good manners, uncomfortable with anyone who isn't impressed by him.",
    speech: "Smooth, practiced compliments and easy laughter; a thin edge of irritation creeps in the moment he isn't the center of attention.",
  },
];

const BLACKWATER_LOREBOOK = [
  {
    keys: ["blackwater reach", "these waters"],
    content:
      "The Blackwater Reach is a stretch of reef-choked, storm-prone water claimed by no crown in practice, however much the navy insists otherwise on paper. It's rich with old wrecks and richer merchant routes, which is exactly why it's thick with pirates, smugglers, and the occasional overconfident naval patrol.",
  },
  {
    keys: ["port kestrel", "the port", "safe harbor", "port"],
    content:
      "Port Kestrel is the closest thing the Reach has to neutral ground — a lawless harbor town where coin buys silence, supplies, and repairs, no questions asked, so long as trouble stays outside the harbor markers. Crews that break that unspoken rule inside the port itself don't get a second chance to dock there.",
  },
  {
    keys: ["the navy", "royal navy", "the crown's ships", "navy patrol"],
    content:
      "The Crown's navy patrols the edges of the Reach rather than its heart, which it knows better than to enter in force. A single navy warship is a genuinely serious threat to a lone pirate vessel — well-crewed, well-armed, and not something to be casually outrun or outfought without real advantage.",
  },
  {
    keys: ["rival crew", "another ship", "rival captain", "captain hollis"],
    content:
      "Captain Ezra Hollis and his ship the Widow's Grief are the Reach's other major crew, competing with Captain Marrow for the same wrecks and the same routes. Relations are tense but not openly at war — an uneasy rivalry that could tip either way depending on how the season's plunder goes.",
  },
  {
    keys: ["treasure", "doubloons", "gold", "loot", "the split", "share of the loot"],
    content:
      "Plunder is divided by a customary split: the captain takes a double share, the quartermaster a share and a half, and the rest is divided evenly among the crew — a system Grimsby enforces to the letter and gets genuinely dangerous about if he suspects anyone's skimming.",
  },
];

const BLACKWATER_CAST = [
  {
    name: "Captain Odessa Marrow",
    role: "the ship's captain",
    bio: "Either a genius or a lunatic, and unreadable either way. Tall and lean, with a commanding presence. Dark hair, usually tied back under her hat. Calm, calculating dark eyes; a weathered but striking face with a thin scar along her jaw. Wears a long dark coat and a tricorn hat. Carries an ornate cutlass and a brass spyglass. Terrifyingly calm in danger, and pursuing a private goal the crew only half understands.",
    personality: "Unnervingly calm under pressure, single-minded about her private goal, unpredictable in what she finds amusing versus unforgivable.",
    speech: "Level, unhurried, faintly amused even in danger; the rare flash of real anger is quiet and all the more frightening for it.",
  },
  {
    name: "Quartermaster Grimsby",
    role: "quartermaster",
    bio: "Superstitious and exacting, and the one who really decides who's trusted aboard. Stocky, weathered, and strong. Graying beard braided through with small charms and bits of bone. Small, watchful, superstitious eyes; weather-beaten skin; missing a couple of fingers. Wears a patched sailor's coat and a few mismatched rings he considers lucky. Carries a tally book and a collection of good-luck charms. Keeps his own tally of debts and omens.",
    personality: "Superstitious and exacting, values order and debts paid, grudgingly fair to anyone who proves reliable.",
    speech: "Mutters omens and tallies under his breath; issues judgments in short, final-sounding statements.",
  },
  {
    name: "Pip",
    role: "fellow press-ganged newcomer",
    bio: "Scared, scheming, and not yet sure whether to ally with you or sell you out. Small, thin, scrawny. Messy, uncut hair, wide nervous eyes, a young unsure face. Wears an oversized borrowed coat and rope-soled shoes. Has rope burns on both hands and keeps a stolen trinket hidden away. Working an angle of their own to get off this ship.",
    personality: "Scared and self-interested but not cruel, quick to scheme under pressure, capable of real loyalty if given a reason to trust.",
    speech: "Nervous rambling and half-finished plans; goes quiet and surprisingly steady in the moments that actually matter.",
  },
];

const STORIES = [
  {
    id: "nightingale",
    title: "The Nightingale Case",
    genre: "Noir Mystery",
    accent: "#8B3A3A",
    coverArt: "/art/npc-lyra.png",
    role: "A broke private investigator, three days behind on rent",
    blurb:
      "A torch singer walks into your office with a photograph of a dead man who supposedly died two years ago. Somewhere in this city, someone is lying.",
    characters: NIGHTINGALE_CAST,
    lorebook: NIGHTINGALE_LOREBOOK,
    systemPrompt: (ctx) =>
      "You are the narrator and game master of an interactive noir mystery called 'The Nightingale Case', set in a rain-slicked 1940s American city. The user plays a broke, world-weary private investigator. Narrate in vivid, hard-boiled second person ('you'). Build an actual mystery with consistent facts, suspects, and clues — remember every detail you invent and never contradict it." +
      NARRATIVE_PACING_NOTE +
      " Never break character, never mention being an AI, never add meta commentary, and never use markdown headers or lists — prose only." +
      castBlock(NIGHTINGALE_CAST) +
      UNIVERSAL_QUALITY_NOTE +
      SIMPLE_ENGLISH_NOTE +
      stateInstructionBasic() +
      nameInstruction(ctx.name),
  },
  {
    id: "ashgard",
    title: "Wings Over Ashgard",
    genre: "Fantasy",
    accent: "#C9A227",
    coverArt: "/art/cover-ashgard.png",
    role: "A newly bonded rider to a wild, half-tamed dragon",
    blurb:
      "The bonding scar on your palm still burns. Your dragon answers to no one, the mountain hold is starving, and the old riders don't trust you yet.",
    characters: ASHGARD_CAST,
    lorebook: ASHGARD_LOREBOOK,
    systemPrompt: (ctx) =>
      "You are the narrator and game master of an interactive high-fantasy adventure called 'Wings Over Ashgard'. The user plays a newly bonded dragon rider in a mountain hold under threat. Narrate in immersive, sensory second person ('you'). Maintain a consistent world: the dragon's temperament, the hold's politics, and any characters or threats you introduce." +
      NARRATIVE_PACING_NOTE +
      " Never break character, never mention being an AI, no markdown headers or lists — prose only." +
      castBlock(ASHGARD_CAST) +
      UNIVERSAL_QUALITY_NOTE +
      SIMPLE_ENGLISH_NOTE +
      stateInstructionBasic() +
      nameInstruction(ctx.name),
  },
  {
    id: "reincarnation",
    title: "Echoes of a Second Life",
    genre: "Isekai Reincarnation",
    accent: VIOLET,
    coverArt: "/art/cover-isekai.png",
    role: "A monster of your choosing, in a world of every race and magic",
    blurb:
      "You died. You woke up as something else — small, strange, and far from human — in a world of humans, elves, fae, and dragons that has no idea you used to be one of them.",
    isRPG: true,
    characters: ISEKAI_CAST,
    lorebook: ISEKAI_LOREBOOK,
    systemPrompt: (ctx) => isekaiSystemPrompt(ctx.monster, ctx.name),
  },
  {
    id: "signal-lost",
    title: "Signal Lost",
    genre: "Sci-Fi",
    accent: "#3F6D63",
    coverArt: "/art/cover-signal.png",
    playerArt: "/art/player-signal.png",
    role: "The last engineer awake on a drifting research station",
    blurb:
      "Cryo failed early. The rest of the crew won't wake for another four months, and something on the hull sensor logs woke up before you did.",
    characters: SIGNAL_CAST,
    lorebook: SIGNAL_LOREBOOK,
    systemPrompt: (ctx) =>
      "You are the narrator and game master of an interactive sci-fi survival story called 'Signal Lost', set on a damaged research station drifting off its course. The user plays the sole awake engineer. Narrate in tense, technical-but-readable second person ('you'). Track the station's systems, oxygen, and any threats or characters consistently once established." +
      NARRATIVE_PACING_NOTE +
      " Never break character, never mention being an AI, no markdown headers or lists — prose only." +
      castBlock(SIGNAL_CAST) +
      UNIVERSAL_QUALITY_NOTE +
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
    lorebook: VELLMOOR_LOREBOOK,
    systemPrompt: (ctx) =>
      "You are the narrator and game master of an interactive gothic horror story called 'The Vellmoor Estate'. The user plays a night-nurse hired to a reclusive, unwell lord in a decaying manor. Narrate in slow-building, atmospheric second person ('you'), favoring dread over gore. Keep the house's geography, staff, and secrets consistent once established." +
      NARRATIVE_PACING_NOTE +
      " Never break character, never mention being an AI, no markdown headers or lists — prose only." +
      castBlock(VELLMOOR_CAST) +
      UNIVERSAL_QUALITY_NOTE +
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
    playerArt: "/art/player-rosemere.png",
    coverArt: "/art/npc-ashworth.png",
    blurb:
      "Your family needs this season to end in a good match. Unfortunately, the only guest who can keep pace with your wit is the one man your aunt has forbidden you to encourage.",
    characters: ROSEMERE_CAST,
    lorebook: ROSEMERE_LOREBOOK,
    systemPrompt: (ctx) =>
      "You are the narrator and game master of an interactive Regency-era romance called 'A Season at Rosemere', set at a country house party. The user plays a witty, financially precarious gentlewoman navigating society. Narrate in warm, dry, Austen-flavored second person ('you'). Maintain consistent guests, gossip, and romantic tension once established." +
      NARRATIVE_PACING_NOTE +
      " Never break character, never mention being an AI, no markdown headers or lists — prose only." +
      castBlock(ROSEMERE_CAST) +
      UNIVERSAL_QUALITY_NOTE +
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
    lorebook: BLACKWATER_LOREBOOK,
    systemPrompt: (ctx) =>
      "You are the narrator and game master of an interactive pirate adventure called 'The Blackwater Reach'. The user plays a reluctant new crew member aboard a ship of uncertain loyalties. Narrate in salt-worn, adventurous second person ('you'). Maintain consistent crew, ship, and any maps or threats once established." +
      NARRATIVE_PACING_NOTE +
      " Never break character, never mention being an AI, no markdown headers or lists — prose only." +
      castBlock(BLACKWATER_CAST) +
      UNIVERSAL_QUALITY_NOTE +
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
  if (story.coverArt) {
    return (
      <button
        onClick={() => onChoose(story)}
        className="relative text-left w-full rounded-sm overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:rotate-1 focus:outline-none focus:-translate-y-1"
        style={{
          boxShadow: `0 6px 0 -2px ${PAPER_DIM}, 0 14px 24px -10px rgba(0,0,0,0.55)`,
          border: `1px solid ${PAPER_DIM}`,
          aspectRatio: "3 / 4",
        }}
      >
        <img
          src={story.coverArt}
          alt={story.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10,8,6,0.05) 0%, rgba(10,8,6,0.15) 40%, rgba(10,8,6,0.92) 78%, rgba(10,8,6,0.98) 100%)",
          }}
        />
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
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
          {savedAs && (
            <span
              className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-sm"
              style={{ fontFamily: "'Courier Prime', monospace", color: INK, backgroundColor: PAPER }}
            >
              Continue as {savedAs}
            </span>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3
            className="text-xl mb-1.5 leading-snug"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: PAPER }}
          >
            {story.title}
          </h3>
          <p
            className="text-xs mb-2 leading-relaxed italic line-clamp-3"
            style={{ fontFamily: "'Newsreader', serif", color: "#D9D0C0" }}
          >
            {story.blurb}
          </p>
          <p
            className="text-[10px] uppercase tracking-wide pt-2"
            style={{
              fontFamily: "'Courier Prime', monospace",
              color: "#B7AC96",
              borderTop: "1px dashed rgba(255,255,255,0.2)",
            }}
          >
            You play: {story.role}
          </p>
        </div>
      </button>
    );
  }
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
          opacity: 0.16,
          backgroundImage: "url(/art/coven.png)",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,.9), transparent 78%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,.9), transparent 78%)",
          filter: "saturate(.7) contrast(1.05)",
        }}
      />
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
                      overflow: "hidden",
                      borderRadius: "50%",
                      border: `1px solid ${active ? "rgba(217,119,66,.5)" : "rgba(236,229,216,.13)"}`,
                      background: "#0d0c10",
                      fontSize: 20,
                    }}
                  >
                    {m.art ? (
                      <img
                        src={m.art}
                        alt={m.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          filter: active
                            ? "saturate(1) contrast(1.04) brightness(1)"
                            : "saturate(.7) contrast(1.02) brightness(.78)",
                        }}
                      />
                    ) : (
                      m.emoji
                    )}
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
                    overflow: "hidden",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid rgba(236,229,216,.2)",
                    boxShadow: "inset 0 0 40px rgba(8,7,10,.9), 0 14px 40px rgba(0,0,0,.55)",
                    background: "#0d0c10",
                    fontSize: 72,
                  }}
                >
                  {s.art ? (
                    <img
                      src={s.art}
                      alt={s.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        filter: "saturate(.92) contrast(1.04) brightness(.94)",
                      }}
                    />
                  ) : (
                    s.emoji
                  )}
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

function CharacterDebutCard({ character }) {
  return (
    <div className="w-full flex justify-start mb-4">
      <div
        className="w-full max-w-[280px] rounded-sm overflow-hidden"
        style={{ border: `1px solid ${PAPER_DIM}`, boxShadow: "0 10px 26px -12px rgba(0,0,0,0.6)" }}
      >
        <img
          src={character.art}
          alt={character.name}
          style={{ width: "100%", height: 320, objectFit: "cover", display: "block" }}
        />
        <div className="p-3" style={{ backgroundColor: PAPER }}>
          <div
            className="text-base leading-snug"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: INK }}
          >
            {character.name}
          </div>
          {character.role && (
            <div
              className="text-[10px] uppercase tracking-wide mt-0.5"
              style={{ fontFamily: "'Courier Prime', monospace", color: INK_SOFT }}
            >
              {character.role}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MentionedCharacters({ text, characters }) {
  if (!text || !characters || characters.length === 0) return null;
  const mentioned = characters.filter((c) => c.art && text.includes(c.name));
  if (mentioned.length === 0) return null;
  return (
    <div className="w-full flex justify-start mb-4">
      <div className="flex flex-wrap gap-3 max-w-[85%] sm:max-w-[70%]">
        {mentioned.map((c) => (
          <div
            key={c.name}
            className="flex items-center gap-2 rounded-sm pr-3"
            style={{ backgroundColor: PAPER, border: `1px solid ${PAPER_DIM}` }}
          >
            <img
              src={c.art}
              alt={c.name}
              style={{ width: 40, height: 40, objectFit: "cover", borderRadius: "2px 0 0 2px" }}
            />
            <span
              className="text-[11px]"
              style={{ fontFamily: "'Courier Prime', monospace", color: INK }}
            >
              {c.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Message({ msg, isTyping, revealCount, onSkip }) {
  const isUser = msg.role === "user";
  const shown = isTyping ? msg.display.slice(0, revealCount) : msg.display;
  const canSkip = isTyping && revealCount < msg.display.length;
  return (
    <div className={`w-full flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        onClick={canSkip ? onSkip : undefined}
        className="max-w-[85%] sm:max-w-[70%] rounded-sm px-4 py-3"
        style={
          isUser
            ? {
                backgroundColor: "#2A2620",
                color: PAPER,
                fontFamily: "'Courier Prime', monospace",
                fontSize: "0.9rem",
                whiteSpace: "pre-wrap",
              }
            : {
                backgroundColor: PAPER,
                color: INK,
                fontFamily: "'Newsreader', serif",
                fontSize: "1.05rem",
                lineHeight: 1.65,
                boxShadow: "0 8px 20px -12px rgba(0,0,0,0.5)",
                whiteSpace: "pre-wrap",
                cursor: canSkip ? "pointer" : "default",
              }
        }
      >
        {shown}
        {canSkip && (
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
              <div className="flex items-center gap-3 mb-1">
                {c.art && (
                  <img
                    src={c.art}
                    alt={c.name}
                    style={{ width: 48, height: 48, objectFit: "cover", borderRadius: "2px", flexShrink: 0 }}
                  />
                )}
                <div className="flex items-center justify-between flex-1 min-w-0">
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
              </div>
              <p
                className="text-xs italic leading-relaxed mb-2"
                style={{ fontFamily: "'Newsreader', serif", color: "#3B3527" }}
              >
                {c.bio}
              </p>
              {c.personality && (
                <p
                  className="text-[11px] leading-relaxed mb-1"
                  style={{ fontFamily: "'Courier Prime', monospace", color: INK_SOFT }}
                >
                  <span style={{ color: INK, fontWeight: 700 }}>Personality: </span>
                  {c.personality}
                </p>
              )}
              {c.speech && (
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ fontFamily: "'Courier Prime', monospace", color: INK_SOFT }}
                >
                  <span style={{ color: INK, fontWeight: 700 }}>Manner: </span>
                  {c.speech}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RelationshipsPanel({ relationships, characters, onClose }) {
  const findArt = (name) => {
    const match = characters && characters.find((c) => c.name === name);
    return match ? match.art : null;
  };
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
            <Heart size={18} />
            Relationships
          </h3>
          <button onClick={onClose} style={{ color: PAPER }}>
            <X size={18} />
          </button>
        </div>
        {(!relationships || relationships.length === 0) && (
          <p
            className="text-sm italic text-center py-6"
            style={{ fontFamily: "'Newsreader', serif", color: PAPER_DIM }}
          >
            No one has formed an opinion of you yet — keep going.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {relationships &&
            relationships.map((r, i) => {
              const art = findArt(r.name);
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-sm p-3"
                  style={{ backgroundColor: PAPER, border: `1px solid ${PAPER_DIM}` }}
                >
                  {art && (
                    <img
                      src={art}
                      alt={r.name}
                      style={{ width: 44, height: 44, objectFit: "cover", borderRadius: "2px", flexShrink: 0 }}
                    />
                  )}
                  <div className="min-w-0">
                    <div
                      className="text-sm mb-0.5"
                      style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: INK }}
                    >
                      {r.name}
                    </div>
                    <div
                      className="text-xs italic leading-snug"
                      style={{ fontFamily: "'Newsreader', serif", color: "#3B3527" }}
                    >
                      {r.status}
                    </div>
                  </div>
                </div>
              );
            })}
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
  const [relationships, setRelationships] = useState(() => (resumeData && resumeData.relationships) || []);
  const [showRelationships, setShowRelationships] = useState(false);
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
      // Pull in only the world facts relevant to what's actually being
      // discussed right now, based on the last few turns — keeps the model
      // grounded in a consistent world without bloating every request with
      // the entire lorebook.
      const recentText = history
        .slice(-6)
        .map((m) => m.content || "")
        .join(" ");
      const activeLore = story.lorebook ? getActiveLore(story.lorebook, recentText) : "";
      res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: systemPrompt + activeLore,
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
    if (state && Array.isArray(state.relationships)) {
      setRelationships((prev) => {
        const merged = [...prev];
        for (const update of state.relationships) {
          if (!update || typeof update.name !== "string") continue;
          const i = merged.findIndex((r) => r.name === update.name);
          const entry = { name: update.name, status: update.status || "" };
          if (i === -1) merged.push(entry);
          else merged[i] = entry;
        }
        return merged;
      });
    }
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
      // Scale the reveal speed to length so a short reply and a long reply
      // both finish animating in roughly the same amount of time.
      const TARGET_DURATION_MS = 2500;
      const TICK_MS = 12;
      const ticks = Math.max(1, TARGET_DURATION_MS / TICK_MS);
      const perTick = Math.max(3, Math.ceil(full.length / ticks));
      timerRef.current = setInterval(() => {
        setRevealCount((c) => {
          const next = c + perTick;
          if (next >= full.length) {
            clearInterval(timerRef.current);
            return full.length;
          }
          return next;
        });
      }, TICK_MS);
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
        relationships,
        updatedAt: Date.now(),
      });
      if (!cancelled) setSaveStatus(ok ? "saved" : "error");
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, gameState, pendingChoices, suggestedActions, relationships, saveKey, monster, characterName]);

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
      {showRelationships && (
        <RelationshipsPanel
          relationships={relationships}
          characters={story.characters}
          onClose={() => setShowRelationships(false)}
        />
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
            {story.characters && (
              <button
                onClick={() => setShowRelationships(true)}
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-sm"
                style={{ fontFamily: "'Courier Prime', monospace", color: PAPER }}
              >
                <Heart size={16} />
                Relationships
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
            {story.playerArt && (
              <img
                src={story.playerArt}
                alt={characterName || "You"}
                title={characterName || "You"}
                style={{
                  width: 32,
                  height: 32,
                  objectFit: "cover",
                  borderRadius: "50%",
                  border: `2px solid ${story.accent}`,
                }}
              />
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
              <React.Fragment key={i}>
                <Message
                  msg={msg}
                  isTyping={i === messages.length - 1 && msg.role === "assistant"}
                  revealCount={revealCount}
                  onSkip={() => {
                    clearInterval(timerRef.current);
                    setRevealCount(msg.display.length);
                  }}
                />
                {msg.role === "assistant" &&
                  story.characters &&
                  (() => {
                    const priorText = messages
                      .slice(0, i)
                      .filter((m) => m.role === "assistant")
                      .map((m) => m.display)
                      .join(" ");
                    const withArt = story.characters.filter((c) => c.art && msg.display.includes(c.name));
                    const debuting = withArt.filter((c) => !priorText.includes(c.name));
                    const known = withArt.filter((c) => priorText.includes(c.name));
                    return (
                      <>
                        {debuting.map((c) => (
                          <CharacterDebutCard key={c.name} character={c} />
                        ))}
                        {known.length > 0 && (
                          <MentionedCharacters text={known.map((c) => c.name).join(" ")} characters={known} />
                        )}
                      </>
                    );
                  })()}
              </React.Fragment>
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
