import express, { response } from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as env from "./environment/environment";
import * as worldprompts from "./environment/worldprompts"
import * as db from "./db-connection";

const app = express();
app.use(cors());


//app.use(express.json());  //no puedo subir imagen uso esto ->

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));


import bodyParser from "body-parser";
const jsonParser = bodyParser.json();

const genAI = new GoogleGenerativeAI(env.environment.api_key);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Escogemos el modelo del LLM que queremos usar
const modelImage = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" })


let gameResponse = {
  player_id: "",
  descripcion: "",
  vida: "",
  fuerza: "",
  agilidad: "",
  suerte: "",
  alive: "",
  run: 0,
  narrativa: "",
  opcionA: "",
  opcionB: "",
  opcionC: "",
};

let currentStats = {
  vida: 0,
  fuerza: 0,
  agilidad: 0,
  suerte: 0,
};

let userpromt = ""; // Variable para almacenar la respuesta del usuario
let finalBossDead = false; // Variable global para el estado del boss
let game_ended = false; // Variable para el estado de la partida
let currentObjective = ""; // Objetivo principal de la aventura 

const imgChat = modelImage.startChat({
  history: []
})

let chat = model.startChat({
  history: []
});

app.get("/clearHistory", (req, res) => {
  chat = model.startChat({ history: [] });
  console.log('History cleared')
});



// Obtener compañero de un personaje
app.get("/companero/:user_email", async (req, res) => {
  const userEmail = req.params.user_email;

  if (!userEmail || typeof userEmail !== "string") {
    return res.status(400).json({ error: "Email de usuario inválido" });
  }

  try {
    const result = await db.query(
      `
      SELECT c.companion_id, p.name AS companion_name
      FROM companero c
      LEFT JOIN personajes p ON c.companion_id = p.id
      WHERE c.id_user = $1
      `,
      [userEmail]
    );

    if (result.rowCount === 0) {
      return res.json({ companion_id: null, companion_name: null });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching companion:", err);
    res.status(500).json({ error: "Error fetching companion" });
  }
});

app.post("/companero", async (req, res) => {
  const { id_user, companion_id } = req.body;

  if (!id_user || typeof id_user !== "string") {
    return res.status(400).json({ error: "id_user inválido" });
  }

  const companionId = Number(companion_id);
  if (!Number.isInteger(companionId)) {
    return res.status(400).json({ error: "companion_id inválido" });
  }

  try {
    const result = await db.query(
      `
      INSERT INTO companero (id_user, companion_id)
      VALUES ($1, $2)
      ON CONFLICT (id_user) DO NOTHING
      RETURNING id_user, companion_id
      `,
      [id_user, companionId]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({
        error: "Este usuario ya tiene asignado un compañero",
      });
    }

    console.log("Compañero creado:", result.rows[0]);
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creando companero:", err);
    return res.status(500).json({ error: "Error creando companero" });
  }
});

app.delete("/companero/:user_email", async (req, res) => {
  const userEmail = req.params.user_email;

  if (!userEmail || typeof userEmail !== "string") {
    return res.status(400).json({ error: "Email de usuario inválido" });
  }

  try {
    const result = await db.query(
      `DELETE FROM companero WHERE id_user = $1 RETURNING companion_id`,
      [userEmail]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "No se encontró compañero para eliminar" });
    }

    res.json({ message: "Compañero eliminado", companion_id: result.rows[0].companion_id });
  } catch (err) {
    console.error("Error eliminando compañero:", err);
    res.status(500).json({ error: "Error eliminando compañero" });
  }
});

app.get("/gemini/:id", async (req, res) => {
  // Endpoint para iniciar la aventura
  console.log(`Petición recibida al endpoint GET /gemini`);
  const characterId = Number(req.params.id);

  // Obtener personaje
  const result = await db.query(
    `SELECT id, name, description, raza, health, strenght, agility, luck,
            level, experience, coin, is_alive, user_id, svg
     FROM personajes
     WHERE id = $1`,
    [characterId]
  );

  if (result.rowCount === 0) return res.status(404).json({ error: "Personaje no encontrado" });
  const personaje = result.rows[0];

  // Obtener aventuras previas
  const registrosQuery = await db.query(
    `SELECT id, nombre_aventura, descripcion, character_id
     FROM registros
     WHERE character_id = $1
     ORDER BY id DESC`,
    [characterId]
  );
  const registrosPersonajes = registrosQuery.rows;

  // Obtener compañero si existe (buscando por id_user)
  const companionResult = await db.query(
    `SELECT c.companion_id, p.name AS companion_name
   FROM companero c
   LEFT JOIN personajes p ON c.companion_id = p.id
   WHERE c.id_user = $1`,
    [personaje.user_id] // 
  );

  // Desestructuramos de forma segura
  const { companion_id = null, companion_name = null } =
    companionResult.rows[0] || {};

  // Texto descriptivo del compañero
  const companionText = companion_name
    ? `El protagonista viaja acompañado de su compañero ${companion_name}. Su relación es cordial y ayuda en las decisiones y acciones. Llama al compañero por su nombre: ${companion_name}`
    : `El protagonista viaja solo sin compañero.`;

  // Stats iniciales
  currentStats = {
    vida: Number(personaje.health) || 0,
    fuerza: Number(personaje.strenght) || 0,
    agilidad: Number(personaje.agility) || 0,
    suerte: Number(personaje.luck) || 0,
  };

  // Prompt inicial de narrativa con compañero incluido
  const promtNarrativa = `
You are a game engine and GameMaster for a roleplaying game. Your job is to simulate a short session with functional narrative using the provided lore, clear decisions, and persistent consequences. You do not write a literary story, you output the progression of a roleplaying session.

PAST ADVENTURES OF THE CHARACTER
${registrosPersonajes}

You must use the past adventures to keep continuity. If the last adventure ended in one region, the next one should start in that same region or nearby. If the character has traveled far, you must briefly explain how and why.

If there are no past adventures, you must create an introductory story to the world. The protagonist arrives to the kingdom or starts in a small canon village doing a routine job, and is naturally pushed into an adventure.

MANDATORY WORLD CANON
The world is called Erlar Tierra de las Estrellas. This lore is fixed canon and must be respected. Never invent a different world. You may invent small details only if they fit the canon, but you must not change names, kingdoms, factions, places, history, or concepts.

The lore exists only to anchor the setting, kingdoms, factions, places, concepts, and characters. It does not exist to make the protagonist a destined hero or a main canonical figure. The protagonist is just another person in Erlar.
The protagonist personal story must not interfere with the main politics or culture of the world. The protagonist must not be part of any main canonical plot, only personal small scale stories inside the world.

Universe
${worldprompts.lore.universe}

Characters
${worldprompts.lore.characters}

Places
${worldprompts.lore.places}

Factions
${worldprompts.lore.factions}

Concepts
${worldprompts.lore.concepts}

Stories
${worldprompts.lore.stories}

COMPANION INFO
${companionText}

IMPORTANT CLOSED WORLD RULES
Use only the provided lore. Do not create your own original place names or major canonical characters.
Do not create new councils, conclaves, archives, orders, institutions, or capitalized organizations not present in the lore.
If a location is needed, it must be exactly one of the names inside Places.
If a new minor NPC is needed, do not give a unique proper name, describe by role only, for example un posadero, una guardia, una mercader, un carretero, una curandera.
Do not use or mention the names Oakheaven or Elara.

NARRATION RULES
Always narrate in third person and never address the player directly. Do not use tú, tu, you, or similar expressions. Always refer to the protagonist by their name or implicitly.

The world is medieval and fantasy. The tone is serious and coherent. Descriptions must be concise, evocative, and direct, without excessive flourish.

TURN STRUCTURE RULES
The story advances in turns. Each response is ONE single short paragraph.
Do NOT write the whole adventure in one message. Do NOT summarize long sequences.
No time skips longer than a few minutes. Never jump hours or days forward in a single response.
You must NEVER resolve the final objective in the first response.
In general, the final objective should require multiple turns to complete.
End every response with an unresolved situation that naturally requires the next decision from the protagonist.
Do NOT conclude the adventure unless you are explicitly instructed with the exact word FIN.

HUMBLE BEGINNING AND EVERYDAY ADVENTURES
The protagonist starts as nobody. Not famous, not chosen, not special by destiny or prophecy, no privileged connections, no favoritism. Their life and reputation are built from zero. The world does not revolve around the protagonist.

Missions must be simple and everyday, appropriate for a beginner. Tavern errands, deliveries, small escorts, recovering stolen objects, investigating noises in a barn, clearing a cellar, protecting a modest caravan, finding a missing person, dealing with local bandits, resolving a neighbor dispute, escorting a messenger, guarding a gate, gathering herbs on a dangerous road, acting as a guide, patrolling, negotiating a debt, recovering a minor item, putting out a fire, helping in a disaster, or surviving a hard night. Real danger exists, but at human scale.

Common enemies must be normal or local threats: thieves, bandits, swindlers, beasts, wolves, boars, feral dogs, scavengers, low rank cultists, opportunistic mercenaries, small creatures, dangerous vermin, corrupt guards, simple traps, illness, poison, hostile weather, or minor magic out of control. Legendary final villains or world ending threats must not appear unless clearly justified by the character history and progression.

The session always begins in an initially calm or stable situation within Erlar canon, such as an inn, a road between duchies, guard duty at a fort, a market visit, a quiet night in a city, or a small errand. It must not start with immediate combat, but it must introduce clear tension or an anomaly early.

EPISODIC ADVENTURES AND REAL PROGRESSION
Each session is its own self contained adventure in the protagonist life, not a chapter of one single central story. A conflict or goal must arise for this specific adventure, but it does not have to connect directly to previous adventures.

Progression must be earned through past adventures and history. Past adventures represent reputation, practical experience, enemies made, favors, contacts, bad fame, lingering wounds, lessons, and consequences. Growth must be slow, coherent, and earned. If the protagonist has not accumulated meaningful adventures, they must not receive high level missions or privileged access to important figures or places.

STATUS AND SOCIAL RISE
The protagonist cannot gain high status for free. Roles such as royal escort, right hand, counselor, commander, nobility, or privileged access to leaders and restricted places can only happen if earned coherently through prior choices, reputation, merit, sacrifice, alliances, or accumulated favors.

VARIETY OF RESOLUTION AND DANGERS
The adventure must not be only combat. There must be multiple ways to progress or succeed: negotiation, deception, investigation, stealth, escape, survival, solving a social conflict, discovering information, completing an errand, breaking a minor curse, recovering an object, escorting without fighting, disarming traps, or surviving an extreme situation.

There must also be multiple ways to fail or die beyond combat wounds: poison, infection, slow bleeding, traps, fires, collapses, hypothermia, hunger, dehydration, mismanaged astral magic, curses, legal consequences, betrayal, or poor judgment. These dangers must appear logically based on environment and choices.

MORAL DILEMMAS AND OPPORTUNITY COST
In most adventures there must be at least one moral dilemma or opportunity cost choice. Present a situation where a good, compassionate, or just action can delay, complicate, or derail the main goal, while ignoring it or choosing a pragmatic path can speed progress but leaves human, social, or spiritual consequences. These choices must have persistent realistic consequences, without moralizing.

STATS AND RESOLUTION
The protagonist has internal stats representing condition and capabilities. These stats influence outcomes and world reactions.

Stats work like an implicit roll system. The more difficult or risky an action is, the higher the chance of failure. If a hard action succeeds, rewards should be higher. If it fails, punishment should be harsher.

Never show numbers, values, percentages, or explicit mechanics. Describe only narrative effects.

Life represents overall physical state. Strength, agility, and luck influence physical actions, movement, combat, social actions, and circumstantial outcomes.

Consequences are persistent. Wounds, failures, losses, or victories carry over. The world remembers and reacts coherently.

Dialogue can exist but must be brief and functional.

MEMORY AND CALLBACKS
If there are no past adventures, generate an initial adventure that introduces the protagonist naturally and humbly, centered on survival, work, or local conflict, not as the start of a grand prophecy or epic central plot.

Occasionally and naturally, small callbacks may appear, but many adventures must not connect directly. Callbacks must be realistic and scaled to the protagonist reputation: rumors, a closed door, someone recognizing them in a tavern, a minor enemy seeking revenge, an unpaid debt, a favor due, or a social consequence.

FORMAT RESTRICTIONS
Output only narrative text in Spanish.
Do not use lists, numbering, headings, parentheses, or quotation marks.
Use only letters, spaces, commas, and periods.
Never show options, letters A B C, and never foreshadow future consequences. You will only generate decisions when explicitly requested.

CHARACTER DATA
id: ${personaje.id}
Nombre: ${personaje.name}
Descripcion: ${personaje.description}
Vida: ${personaje.health}
Fuerza: ${personaje.strenght}
Agilidad: ${personaje.agility}
Suerte: ${personaje.luck}

These stats are internal. Use them as an implicit resolution system. Never show explicit numbers or values.
`;

  try {
    const objectivePrompt = await chat.sendMessage(`
Generate a final objective for a single short adventure in Erlar Tierra de las Estrellas.

Difficulty and scale constraints
This protagonist is low status and must receive a mundane, local, everyday objective.
The objective must feel like a beginner job: small, grounded, human scale.
No legendary artifacts, no world changing stakes, no secret cores, no prophecies.

Hard bans unless clearly justified by many past adventures
Do NOT use or involve: Corazón Estelar, Ruinas de Asterion, fragmentos estelares as legendary relics, ancient sealed cores, saving kingdoms, unifying realms, major political plots.
Do not invent new place names or institutions. Use only canon Places and Factions from the lore.
Do not use or mention Oakheaven or Elara.

Character context
Level: ${personaje.level}
Experience: ${personaje.experience}
Past adventures count: ${registrosPersonajes?.length ?? 0}

Objective requirements
Concrete, achievable within one short adventure, and consistent with the current region implied by past adventures.
Examples of valid scale: deliver a message, escort a modest cart, recover stolen goods, investigate a local disappearance, clear pests from a cellar, settle a dispute, collect a debt, find herbs, guard a gate, track a small bandit group.

Output
Return ONLY one single sentence in Spanish describing the objective.
No extra text, no quotes, no parentheses, no punctuation beyond a final period
`);
    currentObjective = objectivePrompt.response.text().trim();
    console.log("Objetivo de la aventura:", currentObjective);
  } catch (err) {
    console.error("Error generando objetivo:", err);
    currentObjective = "";
  }

  try {
    const narrativaPrompt = await chat.sendMessage(promtNarrativa);
    const response = await narrativaPrompt.response;

    const resultA = await chat.sendMessage(`
Generate ONLY option A for the current narrative situation.

Option requirements
The option must describe one clear action taken by the protagonist, written in third person, referring to the protagonist by name or implicitly. Never address the player.
It must be a single short sentence, direct and concrete.
The action must be meaningfully different from other options in approach and intent.
It must make sense in the current context and match a serious medieval fantasy tone.

Main mission objective to guide the choice
Objective: ${currentObjective}

Hard constraints
Do not invent new place names or major canonical characters. Use only the provided Erlar lore.
Do not use or mention the names Oakheaven or Elara.

Output format 
Return ONLY the option text in Spanish.
`);

    const resultB = await chat.sendMessage(`
Generate ONLY option B for the current narrative situation.

Option requirements
The option must describe one clear action taken by the protagonist, written in third person, referring to the protagonist by name or implicitly. Never address the player.
It must be a single short sentence, direct and concrete.
The action must be meaningfully different from other options in approach and intent.
It must make sense in the current context and match a serious medieval fantasy tone.

Main mission objective to guide the choice
Objective: ${currentObjective}

Hard constraints
Do not invent new place names or major canonical characters. Use only the provided Erlar lore.
Do not use or mention the names Oakheaven or Elara.

Output format
Return ONLY the option text in Spanish.
`);

    const resultC = await chat.sendMessage(`
Generate ONLY option C for the current narrative situation.

Option requirements
The option must describe one clear action taken by the protagonist, written in third person, referring to the protagonist by name or implicitly. Never address the player.
It must be a single short sentence, direct and concrete.
The action must be meaningfully different from other options in approach and intent.
It must make sense in the current context and match a serious medieval fantasy tone.

Main mission objective to guide the choice
Objective: ${currentObjective}

Hard constraints
Do not invent new place names or major canonical characters. Use only the provided Erlar lore.
Do not use or mention the names Oakheaven or Elara.

Output format
Return ONLY the option text in Spanish.
`);

    const responseA = resultA.response;
    const responseB = resultB.response;
    const responseC = resultC.response;
    let respuesta = {
      narrativa: response.text(),
      opcionA: responseA.text(),
      opcionB: responseB.text(),
      opcionC: responseC.text(),
      companion_id: companion_id,
      companion_name: companion_name,
    };
    res.json(respuesta);
    console.log("Respuesta enviada al cliente: " + JSON.stringify(respuesta));
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error on the initial promt");
  }
});


function parseStat(text: string, fallback: number) {
  const m = text.trim().match(/-?\d+/);
  if (!m) return fallback;              // <-- critical change
  const n = parseInt(m[0], 10);
  return Number.isNaN(n) ? fallback : n;
}


app.get("/geminiresponse/:option", async (req, res) => {
  console.log(`Petición recibida al endpoint GET /geminiresponse/:option`);

  try {
    const userPrompt = req.params.option;

    console.log("Respuesta efectuada cargando prompt...");
    const result = await chat.sendMessage('This is the players choice, now make follow the story taking into account his choice: ' + userPrompt);
    const response = await result.response;

    //const statModified = await chat.sendMessage('Teniendo en cuenta la decision del jugador, has modificado este turno alguna stat? Devuelveme solo "true" o "false" ')

    // Obtener estadísticas del jugador en paralelo

    const vidaPrompt = chat.sendMessage(
      ` Give ONLY the current life number after the last action.
    `
    );
    const fuerzaPrompt = chat.sendMessage(
      ` Give ONLY the current strength number after the last action.
    `
    );
    const agilidadPrompt = chat.sendMessage(
      ` Give ONLY the current agility number after the last action.
    `
    );
    const suertePrompt = chat.sendMessage(
      ` Give ONLY the current luck number after the last action.
    `
    );



    const [vidaResp, fuerzaResp, agilidadResp, suerteResp] = await Promise.all([
      vidaPrompt,
      fuerzaPrompt,
      agilidadPrompt,
      suertePrompt,
    ]);

    const vidaActual = parseStat(vidaResp.response.text(), currentStats.vida);
    const fuerzaActual = parseStat(fuerzaResp.response.text(), currentStats.fuerza);
    const agilidadActual = parseStat(agilidadResp.response.text(), currentStats.agilidad);
    const suerteActual = parseStat(suerteResp.response.text(), currentStats.suerte);

    // actualizar para el siguiente turno
    currentStats = {
      vida: vidaActual,
      fuerza: fuerzaActual,
      agilidad: agilidadActual,
      suerte: suerteActual,
    };


    const aliveActual = vidaActual > 0;

    let opcionA = null,
      opcionB = null,
      opcionC = null;

    if (!aliveActual) {
      const deathReason = await chat.sendMessage('El jugador ha muerto quiero que me des un pequeño epilogo de como ha muerto')
      const epilogue = deathReason.response.text()
      return res.json({
        player_id: "",
        descripcion: "",
        vida: vidaActual,
        fuerza: fuerzaActual,
        agilidad: agilidadActual,
        suerte: suerteActual,
        alive: false,
        run: 0,
        narrativa: epilogue, // ← no más historia
        opcionA: null,
        opcionB: null,
        opcionC: null,
      });
    }

    // Solo generar opciones si el jugador sigue vivo
    if (aliveActual) {
      const resultA = await chat.sendMessage(`
      Generate ONLY option A for the current narrative situation.

      Option requirements
      The option must describe one clear action taken by the protagonist, written in third person, referring to the protagonist by name or implicitly. Never address the player.
      The option must be a single short sentence, direct and concrete.
      Do not include explanations, consequences, or extra details.
      The action must be meaningfully different from other options in approach and intent. If other options are cautious, this one must be riskier and more proactive, and vice versa.
      It must make sense in the current context and match a serious medieval fantasy tone.

      Main mission objective to guide the choice
      Objective: ${currentObjective}

      Hard constraints
      Do not invent new place names or major canonical characters. Use only the provided Erlar lore.
      Do not use or mention the names Oakheaven or Elara.

      Output format
      Return ONLY the option text in Spanish.
      Do not include letters, labels, lists, symbols, quotes, parentheses, or line breaks.
      Do not return arrays, objects, or any special formatting.
      `);

      const resultB = await chat.sendMessage(`
      Generate ONLY option B for the current narrative situation.

      Option requirements
      The option must describe one clear action taken by the protagonist, written in third person, referring to the protagonist by name or implicitly. Never address the player.
      The option must be a single short sentence, direct and concrete.
      Do not include explanations, consequences, or extra details.
      The action must be meaningfully different from other options in approach and intent. If other options are cautious, this one must be riskier and more proactive, and vice versa.
      It must make sense in the current context and match a serious medieval fantasy tone.

      Main mission objective to guide the choice
      Objective: ${currentObjective}

      Hard constraints
      Do not invent new place names or major canonical characters. Use only the provided Erlar lore.
      Do not use or mention the names Oakheaven or Elara.

      Output format
      Return ONLY the option text in Spanish.
      Do not include letters, labels, lists, symbols, quotes, parentheses, or line breaks.
      Do not return arrays, objects, or any special formatting.
      `);

      const resultC = await chat.sendMessage(`
      Generate ONLY option C for the current narrative situation.

      Option requirements
      The option must describe one clear action taken by the protagonist, written in third person, referring to the protagonist by name or implicitly. Never address the player.
      The option must be a single short sentence, direct and concrete.
      Do not include explanations, consequences, or extra details.
      The action must be meaningfully different from other options in approach and intent. If other options are cautious, this one must be riskier and more proactive, and vice versa.
      It must make sense in the current context and match a serious medieval fantasy tone.

      Main mission objective to guide the choice
      Objective: ${currentObjective}

      Hard constraints
      Do not invent new place names or major canonical characters. Use only the provided Erlar lore.
      Do not use or mention the names Oakheaven or Elara.

      Output format
      Return ONLY the option text in Spanish.
      Do not include letters, labels, lists, symbols, quotes, parentheses, or line breaks.
      Do not return arrays, objects, or any special formatting.
      `);

      const [respA, respB, respC] = await Promise.all([
        resultA,
        resultB,
        resultC,
      ]);

      opcionA = respA.response.text();
      opcionB = respB.response.text();
      opcionC = respC.response.text();

    }

    // Preguntamos al LLM si el Final Boss murió después de esta acción
    const finalBossStatusPrompt = await chat.sendMessage(
      `After the last action, has the Final Boss been defeated?
    Return ONLY true or false.
    No extra text, no explanation, no punctuation, no symbols, no line breaks.
    `
    );


    finalBossDead = finalBossStatusPrompt.response.text().trim().toLowerCase() === "true";

    const gameEndedPrompt = await chat.sendMessage(
      `After the last action, has the protagonist achieved the final mission objective?
    Return ONLY true or false.
    No extra text, no explanation, no punctuation, no symbols, no line breaks.
    Note: If the answer is true, the adventure ends immediately.
    `
    )

    game_ended =
      gameEndedPrompt.response.text().trim().toLowerCase() === "true";
    console.log(game_ended)

    // Logica registro de aventuras
    if (game_ended === true) {
      const idChar = await chat.sendMessage(`
      Return ONLY the character id that was provided at the beginning.
      Output format: digits only.
      No extra text, no explanation, no symbols, no punctuation, no line breaks.
      `);
      const nombreAdventura = await chat.sendMessage(`
      Provide a short title for this adventure.
      Return ONLY the title in Spanish.
      Keep it brief: 2 to 6 words.
      No quotes, no parentheses, no punctuation, no extra text, no line breaks.
      `);
      const descripcionAdventura = await chat.sendMessage(`
      Write a brief description of the completed adventure in Spanish.
      It must be at least one paragraph long and detailed enough to be used later to maintain continuity in future adventures.
      Do not include lists, numbering, headings, quotes, parentheses, or special symbols.
      Use only letters, spaces, commas, and periods.
      Return ONLY the description text, with no extra commentary.
      `);

      const nombre = nombreAdventura.response.text().trim();
      const descripcion = descripcionAdventura.response.text().trim();

      // OJO: aquí debe ser número
      const characterId = parseInt(idChar.response.text().trim(), 10);

      if (Number.isNaN(characterId)) {
        console.error("Gemini devolvió un id no numérico:", idChar.response.text());
      } else {
        await db.query(
          "INSERT INTO registros (nombre_aventura, descripcion, character_id) VALUES ($1, $2, $3) RETURNING *",
          [nombre, descripcion, characterId]
        );
        console.log("Registro guardado");
      }
    }




    const gameResponse = {
      player_id: "",
      descripcion: "",
      vida: vidaActual,
      fuerza: fuerzaActual,
      agilidad: agilidadActual,
      suerte: suerteActual,
      alive: aliveActual,
      run: 0,
      narrativa: response.text(),
      opcionA,
      opcionB,
      opcionC,
      finalBossDead, // <-- flag independiente
      game_ended,
    };

    res.json(gameResponse);

    console.log(`
    Historia:
    ${response.text()}

    Player stats updated:
    Vida: ${vidaActual}
    Fuerza: ${fuerzaActual}
    Agilidad: ${agilidadActual}
    Suerte: ${suerteActual}
    Alive: ${aliveActual}
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error when answering prompt");
  }
});


// colores de fondo para cada raza
const RACE_BG: Record<string, string> = {
  "Humano": "#7A4A23",
  "Elfo": "#2E6B4F",
  "Enano": "#5A3B24",
  "Orco": "#4C6B2A",
  "No-muerto": "#2B2340",
  "Reptiliano": "#1F5C5A",
  "Vampiro": "#4A1F2D",
};

app.post("/gemini/avatar", async (req, res) => {
  console.log("Generando avatar...");
  try {
    const description = (req.body.description || "").trim();
    const raza = (req.body.raza || "").trim(); // aquí solo 'raza'

    if (!description) return res.status(400).json({ error: "Falta la descripción" });
    if (!raza) return res.status(400).json({ error: "Falta la raza" });

    const bgColor = RACE_BG[raza];
    if (!bgColor) {
      return res.status(400).json({ error: `Raza inválida: ${raza}` });
    }

    const prompt = `
      Create a SINGLE fantasy character sprite in pixel art, no text.
      Canvas: square, large size (512x512).
      Style: 16-bit RPG pixel art, crisp pixels, NO blur, NO anti-aliasing.
      Full body: show from head to feet, no cropping.
      Centered composition with safe margins (leave empty space around the character, not too much, just enough for later cropping).
      Background: solid flat color ${bgColor}.
      Race: ${raza}.

      IMPORTANT: The appearance must match the description EXACTLY.
      Character description (must follow literally, character can be exagerated in terms of proportions): ${description}
    `;

    const result = await modelImage.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const candidate = result.response?.candidates?.[0];
    if (!candidate) return res.status(500).json({ error: "No se encontró candidato" });

    const imagePart = candidate.content?.parts?.find((p: any) => p.inlineData);
    if (!imagePart?.inlineData) return res.status(500).json({ error: "No se generó imagen" });

    const base64Image = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType;

    return res.json({
      image: `data:${mimeType};base64,${base64Image}`,
      bgColor, // opcional
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error generando el avatar" });
  }
});



//user
app.post("/users", async (req, res) => {
  try {
    console.log("BODY:", req.body);
    const id = req.body.email;
    const name = req.body.given_name || req.body.name;
    if (!id || !name)
      return res.status(400).json({ message: "no hay email o nombre" });

    const exists = await db.query("SELECT * FROM usuario WHERE id = $1", [id]);
    if (exists.rows.length > 0) {
      return res
        .status(200)
        .json({ message: "User existe", user: exists.rows[0] });
    }

    const created = await db.query(
      "INSERT INTO usuario (id, name) VALUES ($1, $2) RETURNING *",
      [id, name]
    );

    return res
      .status(201)
      .json({ message: "User created", user: created.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).send("Internal Server Error");
  }
});

// crear personake

app.post("/create_character", async (req, res) => {
  console.log("Saving character...", req.body);
  try {

    const raza = (req.body.raza ?? req.body.race ?? '').trim();
    const {
      name,
      description,
      health,
      strenght,
      agility,
      luck,
      level,
      experience,
      coin,
      is_alive,
      user_id,
      puntos_disponibles,
      svg
    } = req.body;

    if (!name || !raza || !user_id) {
      return res
        .status(400)
        .json({ message: "Missing name, description or user_id" });
    }

    const q = `
        INSERT INTO Personajes
          (name, description, raza, health, strenght, agility, luck, level, experience, coin, is_alive, user_id, puntos_disponibles, svg)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *;
      `;

    const created = await db.query(q, [
      name,
      description,
      raza,
      health,
      strenght,
      agility,
      luck,
      level,
      experience,
      coin,
      is_alive,
      user_id,
      puntos_disponibles,
      svg
    ]);
    return res
      .status(201)
      .json({ message: "Character created", character: created.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/save_character", async (req, res) => {
  console.log("Saving character...", req.body);

  try {
    const raza = (req.body.raza ?? req.body.race ?? '').trim();

    const {
      id,
      name,
      description,
      health,
      strenght,
      agility,
      luck,
      level,
      experience,
      coin,
      is_alive,
      user_id,
      puntos_disponibles,
      svg
    } = req.body;

    if (!id || !name || !raza || !user_id) {
      return res
        .status(400)
        .json({ message: "Missing id, name, description or user_id" });
    }

    const q = `
      UPDATE personajes
      SET
        name = $2,
        description = $3,
        raza = $4,
        health = $5,
        strenght = $6,
        agility = $7,
        luck = $8,
        level = $9,
        experience = $10,
        coin = $11,
        is_alive = $12,
        user_id = $13,
        puntos_disponibles = $14,
        svg = $15
      WHERE id = $1
      RETURNING *;
    `;

    const updated = await db.query(q, [
      id,
      name,
      description,
      raza,
      health,
      strenght,
      agility,
      luck,
      level,
      experience,
      coin,
      is_alive,
      user_id,
      puntos_disponibles,
      svg
    ]);

    if (updated.rowCount === 0) {
      return res.status(404).json({ message: "Character not found" });
    }

    return res.status(200).json({
      message: "Character updated",
      character: updated.rows[0]
    });

  } catch (e) {
    console.error(e);
    res.status(500).send("Internal Server Error");
  }
});

// Carga los personajes de un usuario para la pagina characters
app.get("/users/:userId/load_characters", async (req, res) => {
  const userId = req.params.userId;
  console.log(`Loading characters...`);
  try {
    const result = await db.query(
      `SELECT id, name, description, raza, health, strenght, agility, luck,
              level, experience, coin, is_alive, user_id, puntos_disponibles, svg
       FROM personajes
       WHERE user_id = $1
       ORDER BY id DESC`,
      [userId]
    );
    console.log(`Fetched characters for user ${userId}:`, result.rows);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching characters" });
  }
});

app.get("/music", async (req, res) => {
  try {
    const result = await chat.sendMessage(
      'Devuélveme SOLO UNA de estas palabras, sin explicaciones ni texto adicional: "Calmado", "Taberna", "Combate" o "Misterio".'
    );

    const musicChoice = result.response.text().trim();

    console.log('Respuesta musica:', musicChoice);

    res.json({ music: musicChoice });
  } catch (error) {
    console.error('Error obteniendo música:', error);
    res.status(500).json({ error: 'Error generando música' });
  }
});

app.get("/background", async (req, res) => {
  try {
    const placesRaw = worldprompts.lore.places;

    // Extrae nombres "NAME: ..." de un string grande (sin usar matchAll)
    const extractNamesFromString = (text: string): string[] => {
      const names: string[] = [];
      const re = /^NAME:\s*(.+)$/gm;
      let m: RegExpExecArray | null;

      while ((m = re.exec(text)) !== null) {
        if (m[1]) names.push(m[1].trim());
      }
      return names;
    };

    let placeNames: string[] = [];

    if (typeof placesRaw === "string") {
      placeNames = extractNamesFromString(placesRaw);
    } else {
      // Si algún día lo cambias a objeto/array, esto lo soporta
      placeNames = Object.values(placesRaw as any)
        .map((p: any) => (typeof p === "string" ? p : p?.NAME ?? p?.name ?? ""))
        .map((s: string) => (s || "").trim())
        .filter(Boolean);
    }

    // Quita duplicados
    const uniqueNames = Array.from(new Set(placeNames));

    const result = await chat.sendMessage(
      `Responde SOLO con UNA de estas ubicaciones EXACTAMENTE como aparece en la lista, la ubicacion deberia ser donde este el personaje (sin comillas, sin explicaciones):\n` +
      uniqueNames.map((n) => `- ${n}`).join("\n")
    );

    // Limpieza ligera por si mete comillas
    const chosen = result.response.text().trim().replace(/^["'“”]+|["'“”]+$/g, "");

    // Garantiza que sea una opción válida
    const fallback = uniqueNames[0] || "Reino de Lumnaris";
    const finalChoice = uniqueNames.includes(chosen) ? chosen : fallback;

    res.json({ background: finalChoice });
    console.log("Respuesta background:", finalChoice);
  } catch (error) {
    console.error("Error obteniendo background:", error);
    res.status(500).json({ error: "Error generando background" });
  }
});

app.get("/users/:charId/registros", async (req, res) => {
  const charId = Number(req.params.charId);

  if (!Number.isInteger(charId)) {
    return res.status(400).json({ error: "charId inválido" });
  }

  try {
    const result = await db.query(
      `
      SELECT id, nombre_aventura, descripcion, character_id
      FROM registros
      WHERE character_id = $1
      ORDER BY id DESC
      `,
      [charId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Error fetching registros by character:", err);
    return res.status(500).json({ error: "Error fetching registros" });
  }
});

// Devuelve un personaje específico por su ID para la pagina game
app.get("/load_game_character/:id", async (req, res) => {
  const characterId = Number(req.params.id);

  if (Number.isNaN(characterId)) {
    return res.status(400).json({ error: "Invalid character id" });
  }

  try {
    const result = await db.query(
      `SELECT id, name, description, raza, health, strenght, agility, luck,
              level, experience, coin, is_alive, user_id, svg
       FROM personajes
       WHERE id = $1`,
      [characterId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Character not found" });
    }

    // Devuelve SOLO el personaje
    res.json(result.rows[0]); // Llama a la función usarPersonaje con el personaje obtenido
    console.log(`Fetched character with id ${characterId}:`, result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching character" });
  }
});

app.get("/win/:id", async (req, res) => {
  const id = Number(req.params.id);
  const wins = 1 // 0–2 points

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid character id" });
  }

  try {
    const result = await db.query(
      `
      UPDATE personajes
      SET puntos_disponibles = puntos_disponibles + $1
      WHERE id = $2
      RETURNING puntos_disponibles
      `,
      [wins, id]
    );
    console.log('Puntos guardados...')

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Character not found" });
    }

    console.log("Puntos recibidos tras victoria:", wins);

    res.json({
      added_points: wins,
      total_points: result.rows[0].puntos_disponibles,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error updating points" });
  }
});

//Borra personajes para no saturar la base de datos
app.delete("/characters/:id", async (req, res) => {
  const characterId = Number(req.params.id);

  if (Number.isNaN(characterId)) {
    return res.status(400).json({ error: "Invalid character id" });
  }

  try {
    const result = await db.query(
      "DELETE FROM personajes WHERE id = $1 RETURNING id",
      [characterId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Character not found" });
    }

    res.json({ success: true, deleted_id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error deleting character" });
  }
});

//Endpoint para obtener todo el LORE
app.get("/api/lore", (_req, res) => {
  res.json(worldprompts.lore);
});

//Endpoint para obtener un tipo especifico (places, characters...)
app.get("/api/lore/:type", (req, res) => {
  const { type } = req.params;
  if (!(type in worldprompts.lore)) {
    return res.status(404).json({ error: `Lore type '${type}' not found` });
  }
  res.json({
    type,
    content: worldprompts.lore[type as keyof typeof worldprompts.lore]
  });
});

// Cache en memoria
let cachedCharacters: any[] = [];
let lastCacheTime: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas en ms

app.get("/characters", async (_req, res) => {
  try {
    const now = Date.now();

    // Si no hay cache o han pasado más de 24h
    if (!cachedCharacters.length || now - lastCacheTime > CACHE_DURATION) {
      // Traer todos los personajes de la BD
      const result = await db.query(`SELECT * FROM personajes`);
      const allCharacters = result.rows;

      if (allCharacters.length <= 4) {
        cachedCharacters = allCharacters;
      } else {
        // Seleccionar 5 aleatorios
        const shuffled = allCharacters.sort(() => 0.5 - Math.random());
        cachedCharacters = shuffled.slice(0, 4);
      }

      lastCacheTime = now;
      console.log("Cache actualizado con 5 personajes aleatorios");
    }

    res.json(cachedCharacters);
  } catch (err) {
    console.error("Error fetching characters:", err);
    res.status(500).json({ error: "Error fetching characters" });
  }
});


const port = 3000;

app.listen(port, () =>
  console.log(`App listening on PORT ${port}.

    ENDPOINTS:
    
    -   /gemini
    -   /geminiresponse
    -   /users
    -   /save_characters
    -   /users/:userId/load_characters


     `)
);
