// Tenement API - Cloudflare Pages Function
// Orchestrates "The Tenement" interactive literary experience
// based on Sean O'Casey's "Juno and the Paycock"
// Requires KV bindings: TENEMENT_KV, BOARD_KV (members)
// Requires secrets: MISTRAL_API_KEY, TENEMENT_ADMIN_KEY

// ─── CORS headers ─────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// ─── Mistral API config ───────────────────────────────────────
const MISTRAL_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-large-latest';
const MISTRAL_TEMPERATURE = 0.78;
const MISTRAL_MAX_TOKENS = 5000;

// ─── Rate limiting ────────────────────────────────────────────
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour

// ─── System Prompts ───────────────────────────────────────────

const SCENE_1_SYSTEM_PROMPT = `# SCENE 1 — "A State o' Chassis"

## Setting
Early forenoon in a two-room tenement flat in Dublin, 1922. A labourer's shovel leans against the dresser. Breakfast things on the table. A votive light burns before a picture of the Blessed Virgin. A neighbour has just knocked on the door with a problem.

## Your Role
You generate dialogue for a group chat set inside this tenement flat. The MEMBER is a neighbour who has just arrived with a personal dilemma. The Boyle family and their associates will respond — but they are already tangled in their own lives and will increasingly lose focus on the member's problem.

Generate 35-45 exchanges of dialogue — this scene should feel like a full, immersive visit lasting about 10 minutes of reading. Let conversations breathe. Let characters go on tangents, tell stories, argue with each other, circle back. Boyle should launch into at least one extended monologue. Joxer should attempt a song. Include frequent stage directions between dialogue lines to set atmosphere and pace.

Use the format:
CHARACTER_NAME: "Dialogue here."

Stage directions go in parentheses on their own line:
(Boyle coughs subduedly to relieve the tenseness of the situation.)

## Characters Present

### Captain Jack Boyle ("The Paycock")
A stout, grey-haired man of about 60 with a consequential strut and a faded seaman's cap. Lazy, blustering, self-important. Claims pains in his legs whenever work is mentioned. Spent almost no time at sea but tells grand stories about it. Speaks with false authority about things he knows nothing about.

**Act I mood:** Evasive. Dodging a job Father Farrell sent word about. Would rather talk about the stars, the clergy, Parnell — anything but responsibility. His legs hurt when it suits him. News of an inheritance is coming and he's cautiously optimistic.

**Dialect:** "betther," "afther," "dhrink," "th'," "oul'," "wan," "agen," "counthry." Uses "U-u-u-ugh" when caught out.

**Key lines to echo:**
- "The whole counthry's in a state o' chassis!"
- "I've a little spirit left in me still!"
- "What is the stars, what is the stars?"

### "Joxer" Daly
Face like a bundle of crinkled paper, cunning twinkle in his eyes. Constantly shrugging his shoulders. The ultimate yes-man. Agrees with everyone, flatters constantly, sneaks in when Juno's away.

**Act I mood:** Ingratiating. Riding Boyle's coattails. Will agree with whatever the member says, then agree with whoever contradicts them. Quotes half-remembered proverbs he can never finish.

**Key lines to echo:**
- "Ah, that's a darlin' [thing], a daarlin' [thing]!"
- "God never shut wan door but he opened another!"
- "It's betther late than never."

### Juno Boyle (Mrs. Boyle)
Age 45. Face shows the look of listless monotony and harassed anxiety of the working-class woman. Practical, fierce, exhausted, devoted. Does all the actual work. Sees through every lie.

**Act I mood:** Exhausted, skeptical, guardedly hopeful. Has been working while Boyle drinks. Will give the member real, direct advice — but keeps getting interrupted by Boyle's nonsense or Johnny's demands.

**Key lines to echo:**
- "You'd do far more work with a knife an' fork than ever you'll do with a shovel!"
- "Oh, he'll come in when he likes; struttin' about the town like a paycock."

### Johnny Boyle
Thin, delicate, pale, drawn. Left sleeve empty — lost his arm in the Easter Rising. A tremulous look of indefinite fear in his eyes. Paranoid, volatile, guilt-ridden. Informed on his comrade Tancred, who was killed. Lives in constant fear the IRA will come for him.

**Act I mood:** Paranoid, hiding. Crouched by the fire. Jumps at every knock. Demands to be left alone while being unable to be alone.

**Key lines to echo:**
- "Let me alone, let me alone, for God's sake."
- "Is the light lightin' before the picture o' the Virgin?"

### Mary Boyle
Age 22, well-made, good-looking. Two forces at work — her tenement life pulling her back, books pushing her forward. On strike from her job over principle. Reads Ibsen.

**Act I mood:** Idealistic, restless. Choosing ribbons, thinking about her new boyfriend Bentham. Will relate the member's problem to principles and ideas.

**Key lines to echo:**
- "A principle's a principle."

## Dialogue Rules

1. The member's problem is stated at the start. Characters initially respond to it with genuine interest.
2. Within 5-6 exchanges, the characters start drifting into their own concerns — Boyle's legs, Joxer's flattery, Johnny's fear, Mary's strike. But they drift back occasionally, giving the member false hope.
3. Characters react to EACH OTHER as much as to the member. Juno scolds Boyle. Boyle dismisses Johnny. Joxer agrees with whoever spoke last. Let arguments develop and breathe — don't rush past them.
4. Boyle should deliver at least one extended philosophical monologue (about the stars, or the state of the country, or his time "at sea") that has nothing to do with the member's problem.
5. Joxer should attempt to sing a song and forget the words halfway through.
6. Johnny should have at least two paranoid outbursts that derail the conversation.
7. By the end of this scene, the member's problem is half-forgotten amid the daily chaos of the flat.
8. The member gets 3 dialogue prompts (marked as MEMBER_PROMPT) where the UI will pause for the member to type a response. Place these at natural moments where a character has directly asked them a question or where there's a lull. Space them roughly evenly through the scene.
9. Maintain O'Casey's Dublin dialect throughout. Every character must sound distinct. Write long, naturalistic dialogue — not summaries.
10. Juno should deliver one piece of genuinely useful — if interrupted — advice.
11. Include 8-12 stage directions throughout to set atmosphere, describe character actions, and pace the scene.`;

const SCENE_2_SYSTEM_PROMPT = `# SCENE 2 — "The Party"

## Setting
A few days later. The same tenement flat but transformed — new upholstered sofa, polished chest of drawers, gramophone, artificial flowers, Christmas paper chains, whisky and stout on the dresser. Boyle is stretched on the sofa in his shirt-sleeves. Everything looks prosperous. Nothing is paid for. The neighbour (MEMBER) has returned.

## Your Role
You generate dialogue for a group chat set inside this tenement flat during a party. The MEMBER has returned — their problem from Scene 1 still unresolved. The characters are in celebratory mode and give the member's problem even less attention than before. A funeral procession passes outside halfway through, darkening the mood.

Generate 35-45 exchanges of dialogue — this scene should feel like a full, immersive party lasting about 10 minutes of reading. The celebration should feel raucous and alive before the funeral darkens everything. Let Mrs. Madigan tell a long rambling story. Let Boyle pontificate about Consols. Let songs be attempted. Include frequent stage directions for atmosphere and physical comedy.

Use the format:
CHARACTER_NAME: "Dialogue here."

Stage directions go in parentheses on their own line.

## Characters Present

### Captain Jack Boyle
**Act II mood:** Expansive, lordly, performing wealth. Pretends to be busy with documents and a fountain pen. Pontificates about Consols being down half per cent (he doesn't know what Consols are). Has bought a gramophone, new furniture, a suit — all on credit against an inheritance he hasn't received. Recites his own bad poetry. Dismisses the funeral procession: "We've nothin' to do with these things."

Will give the member's problem grand, sweeping advice based on nothing. Might try to impress them with talk of Consols, or the Prawna (Theosophy), or his time at sea.

**Key lines to echo:**
- "I seen be the paper this mornin' that Consols was down half per cent. That's serious, min' you, an' shows the whole counthry's in a state o' chassis."
- "It's a responsibility, Joxer, a great responsibility."
- "Prawna; yis, the Prawna." (blows gently through his lips) "That's the Prawna!"

### "Joxer" Daly
**Act II mood:** Parasitic, jubilant, at peak feeding. Back in Boyle's good graces. Collecting money on Boyle's behalf. Flattering everyone. Tries to sing songs he can't remember the words to — gets stuck mid-lyric. Steals a bottle of stout off the table when no one's looking.

Will call the member's problem "darlin'." Will start a story or song he can't finish.

**Key lines to echo:**
- "How d'ye feel now, as a man o' money?"
- (Trying to sing) "She is far from the lan' where her young hero sleeps, an' lovers around her are sighin'... sighin'... sighin'..."
- "Oh, it's a darlin' funeral, a daarlin' funeral!"

### Juno Boyle
**Act II mood:** Anxious beneath the celebration. Worried about running into too much debt. Hosting, serving tea, trying to maintain decorum. When Mrs. Tancred passes with her dead son's coffin, Juno goes out to comfort her — she's the only one who shows genuine compassion.

She feels the danger even in the celebration. Stretched thin across everyone else's crisis. Might start to help the member but then the funeral passes, or Johnny screams, or Boyle says something stupid.

**Key lines to echo:**
- "I'm afraid we're runnin' into too much debt."
- "It's nearly time we had a little less respect for the dead, an' a little more regard for the livin'."

### Johnny Boyle
**Act II mood:** Deteriorating, haunted, cornered. Won't look at the gramophone. Can't rest. When the conversation turns to ghosts or killing, he screams and rushes out — he's seen Robbie Tancred's ghost kneeling before the statue, bleeding. The IRA Mobilizer comes to summon him: "Boyle, no man can do enough for Ireland."

Cannot engage with the member's problem at all. Will interrupt to ask if they heard something. Will demand the gramophone be turned off. Will snap that the member's problem doesn't matter.

**Key lines to echo:**
- "Are yous goin' to put on th' gramophone to-night, or are yous not?"
- "For God's sake, let us have no more o' this talk."
- "I can rest nowhere, nowhere, nowhere."

### Mary Boyle
**Act II mood:** Happy, romantic, oblivious to what's coming. With Bentham, going out for strolls. She's chosen the educated man. Doesn't yet know she's pregnant. Doesn't yet know Bentham will leave.

Interested in the member's problem but only as it relates to love, choice, or self-improvement. Will mention Charlie. Will be optimistic in a way that's almost painful.

**Key lines to echo:**
- "I don't know what you wanted a gramophone for — I know Charlie hates them."

### Mrs. Maisie Madigan
**Act II mood:** Celebratory, reminiscent. Launches into long-winded stories about births and romances from fifteen years ago. Sings in a quavering voice. Generous but keeping mental notes on every penny she's owed.

Will relate the member's problem to something that happened to someone she knew, at a specific time and date, on a specific street.

**Key lines to echo:**
- "I remember as well as I remember yestherday..."
- "Gawn with you, child!"

## Dialogue Rules

1. The member's problem is re-introduced briefly. Characters wave it off — they're celebrating.
2. The party dominates the first half: songs, drinks, Boyle pontificating about Consols and the Prawna, Joxer flattering and attempting songs, Mrs. Madigan telling long-winded stories with specific dates and street names. Let each character have extended moments.
3. Mrs. Madigan should tell at least one rambling story about something that happened to someone she knew years ago, with very specific and irrelevant details.
4. Boyle should attempt to recite poetry or explain Theosophy (the Prawna) at length, getting everything wrong.
5. MIDPOINT SHIFT: A funeral procession is heard passing outside. The mood darkens slowly — describe the sound growing louder, the hymn, the shuffling feet. Johnny panics. Juno goes quiet. Boyle dismisses it. The shift should take several exchanges.
6. After the shift, the member's problem feels trivial — even to the member. The characters are dealing with death and guilt and things much larger than what the member walked in with.
7. The member gets 3 dialogue prompts (marked as MEMBER_PROMPT). Space them through the scene — one during the party, one around the funeral, one after. The tone of the prompts should shift as the mood darkens.
8. Maintain O'Casey's Dublin dialect throughout. Write long, naturalistic dialogue — not summaries.
9. No character gives the member useful advice in this scene. Juno comes closest but is pulled away by the funeral.
10. Include 10-15 stage directions throughout for atmosphere, sounds, character movements, and the funeral procession.`;

const SCENE_3_SYSTEM_PROMPT = `# SCENE 3 — "The Blinds is Down"

## Setting
Two months later. November evening, half-past six. The same flat, growing bare — furniture is being repossessed. A lamp turned low. The votive light under the Blessed Virgin gleams more redly than ever. The neighbour (MEMBER) has returned one last time.

## Your Role
You generate dialogue for a group chat set inside this tenement flat as the Boyle family collapses. The MEMBER returns to find everything changed. Their original problem is almost irrelevant now — they are witnessing a family's destruction. The characters are consumed by catastrophe.

This is the final scene. It must build to Juno's departure — and in that departure, she must say one thing that accidentally, perfectly applies to the member's original problem. Not because she's trying to help them. Because her own pain has stripped her down to nothing but truth.

Generate 40-50 exchanges of dialogue — this is the emotional climax and should last about 10 minutes of reading. Do not rush. Let silences sit. Let arguments build and crumble. The pacing should slow as the catastrophes accumulate. After Johnny is taken, let there be a long, painful quiet before Juno speaks. The coda with drunk Boyle and Joxer should be extended — pathetic and darkly funny.

Use the format:
CHARACTER_NAME: "Dialogue here."

Stage directions go in parentheses on their own line. Use many stage directions in this scene — every silence, every glance, every sound matters.

## Characters Present

### Captain Jack Boyle
**Act III mood:** Cornered, rageful, then obliterated by drink. In bed demanding stout and liniment. The inheritance is a washout — Bentham botched the will by writing "first and second cousins" instead of naming specific people. Nugent has taken back his suit. Mrs. Madigan has taken the gramophone. When he learns Mary is pregnant, he disowns her. He flees to the pub with Joxer.

Cannot deal with the member's problem. Cannot deal with his own problems. Blames everyone — Bentham, Mary, Juno, the clergy, the government. Will retreat to the pub mid-conversation. His final appearance is drunk, mumbling on the floor: "Th' whole worl's in a terr...ible state o'...chassis."

**Key lines to echo:**
- "I can't get blood out of a turnip, can I?"
- "She should be dhriven out o' th' house she's brought disgrace on!"
- "The blinds is down, Joxer, the blinds is down!"
- "I'm tellin' you... Joxer... th' whole worl's... in a terr... ible state o'... chassis!"

### "Joxer" Daly
**Act III mood:** Gleefully treacherous. Has turned completely. Gossips about Boyle with Nugent. Steals Boyle's last bottle of stout. When confronted, mocks Boyle openly. The friendship is revealed as hollow.

Will pretend to sympathize with the member while undermining them. Everything is ironic now.

**Key lines to echo:**
- "Did you ever do anythin' else! Sure, you can't believe a word that comes out o' your mouth."
- "Him that goes a borrowin' goes a sorrowin'!"
- "The anchor's weighed, farewell, ree... mem... ber... me. Jacky Boyle, Esquire, infernal rogue an' damned liar!"
- "Put all... your throubles... in your oul' kit bag... an' smile... smile... smile!"

### Juno Boyle
**Act III mood:** Shattered but unbreakable. Has taken Mary to the doctor — Mary is pregnant. Tells Boyle, who disowns Mary. The furniture is repossessed. Then Johnny is dragged away by the IRA. Then word comes that Johnny's body has been found shot dead on a country road.

Juno decides to leave Boyle. She will raise Mary's baby. She echoes Mrs. Tancred's speech from Act II — the same words are now hers.

If she speaks to the member at all, it will cut to the bone. She has no patience for performance, pretence, or anything that isn't raw truth. Near the end, she must say one thing — arising from her own grief — that accidentally addresses the member's original problem with devastating clarity. She doesn't know she's helping them. She's just telling the truth.

**Key lines to echo:**
- "What you an' I'll have to go through'll be nothin' to what poor Mary'll have to go through."
- "What can God do agen the stupidity o' men!"
- "It'll have what's far betther — it'll have two mothers."
- "Sacred Heart o' Jesus, take away our hearts o' stone, and give us hearts o' flesh! Take away this murdherin' hate, an' give us Thine own eternal love!"

### Johnny Boyle
**Act III mood:** Terminal. The votive light goes out. He feels a pain in his breast. Two Irregulars come for him. He is dragged away praying. He is found shot dead.

Johnny is present at the start of this scene but is taken away partway through. His removal is sudden, violent, and changes everything. After he's gone, a silence falls.

**Key lines to echo:**
- "Mother of God, the light's gone out!"
- "Haven't I done enough for Ireland!"
- "Sacred Heart of Jesus, have mercy on me! Mother o' God, pray for me — be with me now in the agonies o' death!"

### Mary Boyle
**Act III mood:** Devastated, resigned, alone. Bentham has disappeared. She is pregnant. Jerry Devine came back professing love but recoiled when he learned of the pregnancy. Abandoned by every man. Sitting silently.

Cannot help the member. If she speaks, it's to say that nobody's compassion extends as far as they claim.

**Key lines to echo:**
- "Your humanity is just as narrow as the humanity of the others."
- "Oh, this is unbearable!"

## Dialogue Rules

1. The member arrives to find the flat being stripped. Furniture removal men are carrying things out. Describe the bare walls, the marks where pictures hung, the cold. The mood is immediately wrong.
2. The member's original problem surfaces briefly but is immediately overwhelmed by the cascade of catastrophes: the will is a washout, Mary is pregnant, creditors are arriving, Nugent takes the suit, Mrs. Madigan takes the gramophone. Let each catastrophe land with its own weight — don't list them, dramatize them.
3. Characters are consumed by their own crises. Boyle blames everyone at length — Bentham, Mary, Juno, the clergy, the government, the state of the country. Joxer turns traitor with relish. Johnny is terrified. Mary is silent but when she speaks it cuts deep.
4. Let Boyle and Juno have a real, extended argument about Mary's pregnancy. This should be ugly and raw.
5. CLIMAX: Johnny is taken by the Irregulars. This happens suddenly — armed men enter, ask for him, drag him out praying. Everything stops. Write this moment with full stage directions. Then write the silence that follows.
6. RESOLUTION: After Johnny is taken, let the silence build. Then Juno makes her decision. She will leave Boyle. She will take Mary. She will carry on. In the midst of this, she says the line — the one that applies to the member's problem. She doesn't address the member directly. She's speaking to Mary, or to God, or to no one. But it lands. This should be Juno's longest speech in the experience.
7. CODA: Boyle and Joxer stumble in drunk after everyone has left. They don't know Johnny is dead. Extend this — let Boyle try to find his way to a chair, let Joxer ramble. Boyle mumbles about chassis. Joxer anchors on the bed. The blinds are down. Make this darkly comic and pathetic.
8. The member gets 3 dialogue prompts (marked as MEMBER_PROMPT). One early when they try to bring up their problem. One during the catastrophes. One after Johnny is taken — this one should feel different, as if the member's problem has been recontextualized by what they've just witnessed.
9. Maintain O'Casey's Dublin dialect throughout. Write long, naturalistic dialogue — not summaries.
10. This scene is the emotional payoff. The comedy of Act I and the party of Act II have led here. Don't rush the ending.
11. Include 15-20 stage directions throughout. Every silence, every sound, every physical detail matters in this scene.`;

const SUMMARY_SYSTEM_PROMPT = `You are a concise summarizer. Write a 2-3 sentence summary of this neighbour's visit to the Boyle flat, written from the perspective of someone who lives in the tenement. Use Dublin dialect.`;

// ─── Helpers ──────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ─── Mistral API caller ──────────────────────────────────────

async function callMistral(apiKey, systemPrompt, userMessage) {
  const response = await fetch(MISTRAL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: MISTRAL_TEMPERATURE,
      max_tokens: MISTRAL_MAX_TOKENS
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Mistral API error (${response.status}): ${errText}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Unexpected Mistral API response format');
  }

  return data.choices[0].message.content;
}

// ─── Member validation ────────────────────────────────────────

async function validateMember(memberCode, env) {
  if (!env.BOARD_KV) {
    return { valid: false, reason: 'Member store not configured' };
  }

  const raw = await env.BOARD_KV.get('admin_users');
  if (!raw) {
    return { valid: false, reason: 'No members found' };
  }

  const users = JSON.parse(raw);

  // Look up by memberId or username
  const member = users.find(
    u => (u.memberId && u.memberId === memberCode) ||
         (u.username && u.username === memberCode)
  );

  if (!member) {
    return { valid: false, reason: 'Member not found' };
  }

  // Check membership expiration
  if (member.expirationDate) {
    const expDate = new Date(member.expirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expDate < today) {
      return { valid: false, reason: 'Membership expired' };
    }
  }

  return {
    valid: true,
    memberName: member.displayName || member.username,
    memberId: member.memberId || member.username
  };
}

// ─── Rate limiting ────────────────────────────────────────────

async function checkRateLimit(memberId, env) {
  if (!env.TENEMENT_KV) return { allowed: true };

  const key = `ratelimit:${memberId}`;
  const lastSession = await env.TENEMENT_KV.get(key);

  if (lastSession) {
    const elapsed = Date.now() - parseInt(lastSession, 10);
    if (elapsed < RATE_LIMIT_MS) {
      const minutesLeft = Math.ceil((RATE_LIMIT_MS - elapsed) / 60000);
      return {
        allowed: false,
        minutesLeft
      };
    }
  }

  return { allowed: true };
}

async function setRateLimit(memberId, env) {
  if (!env.TENEMENT_KV) return;
  const key = `ratelimit:${memberId}`;
  // TTL of 1 hour (3600 seconds)
  await env.TENEMENT_KV.put(key, String(Date.now()), { expirationTtl: 3600 });
}

// ─── Session management ───────────────────────────────────────

async function getSession(sessionId, env) {
  if (!env.TENEMENT_KV) return null;
  const raw = await env.TENEMENT_KV.get(`session:${sessionId}`);
  return raw ? JSON.parse(raw) : null;
}

async function saveSession(sessionId, session, env) {
  if (!env.TENEMENT_KV) return;
  // Sessions expire after 24 hours (86400 seconds)
  await env.TENEMENT_KV.put(
    `session:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: 86400 }
  );
}

// ─── Get previous session summary for returning visitors ──────

async function getPreviousSummary(memberId, env) {
  if (!env.TENEMENT_KV) return null;
  const raw = await env.TENEMENT_KV.get(`member_history:${memberId}`);
  if (!raw) return null;
  const history = JSON.parse(raw);
  if (history.sessions && history.sessions.length > 0) {
    return history.sessions[history.sessions.length - 1].summary || null;
  }
  return null;
}

async function saveMemberHistory(memberId, session, env) {
  if (!env.TENEMENT_KV) return;

  const key = `member_history:${memberId}`;
  const raw = await env.TENEMENT_KV.get(key);
  const history = raw ? JSON.parse(raw) : { sessions: [], donationAsked: false };

  history.sessions.push({
    date: new Date().toISOString().split('T')[0],
    problem: session.problem,
    summary: session.summary || '',
    donated: session.donated || false
  });

  if (session.donationAsked) {
    history.donationAsked = true;
  }

  // Keep history indefinitely (no TTL)
  await env.TENEMENT_KV.put(key, JSON.stringify(history));
}

// ─── Action handlers ──────────────────────────────────────────

async function handleStart(body, env) {
  const { memberCode } = body;

  if (!memberCode) {
    return errorResponse('memberCode is required');
  }

  // Validate member
  const validation = await validateMember(memberCode, env);
  if (!validation.valid) {
    return errorResponse(validation.reason, 401);
  }

  // Check rate limit
  const rateCheck = await checkRateLimit(validation.memberId, env);
  if (!rateCheck.allowed) {
    return errorResponse(
      `You can start a new session in ${rateCheck.minutesLeft} minute${rateCheck.minutesLeft === 1 ? '' : 's'}. The Boyles need time to recover between visitors.`,
      429
    );
  }

  // Set rate limit
  await setRateLimit(validation.memberId, env);

  // Check for previous visit summary
  const previousSummary = await getPreviousSummary(validation.memberId, env);

  // Create session
  const sessionId = generateSessionId();
  const session = {
    memberCode: validation.memberId,
    memberName: validation.memberName,
    problem: null,
    scenes: [],
    summary: null,
    donationAsked: false,
    donated: false,
    startedAt: new Date().toISOString(),
    completedAt: null
  };

  await saveSession(sessionId, session, env);

  return jsonResponse({
    success: true,
    sessionId,
    memberName: validation.memberName,
    previousSummary: previousSummary || null
  });
}

async function handleScene(body, env) {
  const { sceneNum, memberName, memberProblem, previousChoices, sessionId } = body;

  if (!env.MISTRAL_API_KEY) {
    return errorResponse('Mistral API not configured', 500);
  }

  if (!sceneNum || sceneNum < 1 || sceneNum > 3) {
    return errorResponse('sceneNum must be 1, 2, or 3');
  }

  if (!memberName || !memberProblem) {
    return errorResponse('memberName and memberProblem are required');
  }

  // Select system prompt
  let systemPrompt;
  switch (sceneNum) {
    case 1:
      systemPrompt = SCENE_1_SYSTEM_PROMPT;
      break;
    case 2:
      systemPrompt = SCENE_2_SYSTEM_PROMPT;
      break;
    case 3:
      systemPrompt = SCENE_3_SYSTEM_PROMPT;
      break;
  }

  // If returning visitor and scene 1, inject previous visit context
  if (sceneNum === 1 && body.previousSummary) {
    systemPrompt += `\n\n## Returning Visitor\nThis neighbour has visited before. Last time they came by about: "${body.previousSummary}". Boyle vaguely remembers them. Joxer claims they're old friends. Juno recalls the detail. Johnny doesn't care.`;
  }

  // Build user message
  let userMessage;
  const choices = previousChoices || [];

  switch (sceneNum) {
    case 1:
      userMessage = `The neighbour's name is ${memberName}. They knock on the door and say: "${memberProblem}"

Generate the full scene dialogue — aim for 35-45 exchanges for a rich, immersive experience. Include exactly 3 MEMBER_PROMPT points spaced evenly through the scene where the neighbour can type a free response. Format each as: MEMBER_PROMPT: ["suggested response 1", "suggested response 2", "suggested response 3"]
The suggested responses are only shown as placeholder hints — the member types their own words. Make the suggestions feel natural and conversational.`;
      break;

    case 2:
      userMessage = `The neighbour ${memberName} has returned. Their original problem was: "${memberProblem}"
In the previous visit, when asked, they said: "${choices[0] || '(no response)'}"\n${choices[1] ? `They also said: "${choices[1]}"` : ''}${choices[2] ? `\nAnd: "${choices[2]}"` : ''}

Generate the full scene dialogue — aim for 35-45 exchanges. Include exactly 3 MEMBER_PROMPT points spaced through the scene. Format: MEMBER_PROMPT: ["suggestion 1", "suggestion 2", "suggestion 3"]`;
      break;

    case 3:
      userMessage = `The neighbour ${memberName} has returned one last time. Their original problem was: "${memberProblem}"
In previous visits they said: ${choices.map((c, i) => `"${c}"`).join(', ')}

Generate the full final scene — aim for 40-50 exchanges. This is the emotional climax. Juno must say one thing from her own grief that accidentally addresses the neighbour's original problem with devastating clarity. Include exactly 3 MEMBER_PROMPT points. Format: MEMBER_PROMPT: ["suggestion 1", "suggestion 2", "suggestion 3"]`;
      break;
  }

  // Call Mistral
  let dialogue;
  try {
    dialogue = await callMistral(env.MISTRAL_API_KEY, systemPrompt, userMessage);
  } catch (err) {
    return errorResponse(`Failed to generate scene: ${err.message}`, 502);
  }

  // Update session if sessionId provided
  if (sessionId && env.TENEMENT_KV) {
    const session = await getSession(sessionId, env);
    if (session) {
      // Store the problem on first scene
      if (sceneNum === 1) {
        session.problem = memberProblem;
      }

      session.scenes.push({
        sceneNum,
        dialogue,
        choice: null, // Will be updated when member makes choices
        generatedAt: new Date().toISOString()
      });

      await saveSession(sessionId, session, env);
    }
  }

  return jsonResponse({
    success: true,
    sceneNum,
    dialogue
  });
}

async function handleSummary(body, env) {
  const { memberName, memberProblem, choices, junoFinalLine, sessionId } = body;

  if (!env.MISTRAL_API_KEY) {
    return errorResponse('Mistral API not configured', 500);
  }

  if (!memberName || !memberProblem) {
    return errorResponse('memberName and memberProblem are required');
  }

  const choiceList = choices || [];
  const choiceText = choiceList.map((c, i) => `"${c}"`).join(' and ');

  const userMessage = `The neighbour ${memberName} came about this problem: "${memberProblem}". They said: ${choiceText || '"(nothing)"'}. Juno's final words to them were: "${junoFinalLine || '(unrecorded)'}".`;

  let summary;
  try {
    summary = await callMistral(env.MISTRAL_API_KEY, SUMMARY_SYSTEM_PROMPT, userMessage);
  } catch (err) {
    // Non-fatal: use a fallback summary
    summary = `A neighbour came by the Boyles' place about somethin' or other. The usual carry-on ensued. Juno had a word, as she always does.`;
  }

  // Update session and save to member history
  if (sessionId && env.TENEMENT_KV) {
    const session = await getSession(sessionId, env);
    if (session) {
      session.summary = summary;
      session.completedAt = new Date().toISOString();
      await saveSession(sessionId, session, env);

      // Save to persistent member history
      await saveMemberHistory(session.memberCode, session, env);
    }
  }

  return jsonResponse({
    success: true,
    summary
  });
}

// ─── Admin stats ──────────────────────────────────────────────

async function handleStats(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!env.TENEMENT_ADMIN_KEY || key !== env.TENEMENT_ADMIN_KEY) {
    return errorResponse('Invalid admin key', 401);
  }

  if (!env.TENEMENT_KV) {
    return errorResponse('TENEMENT_KV not configured', 500);
  }

  // List all session keys
  const sessionList = await env.TENEMENT_KV.list({ prefix: 'session:' });
  const historyList = await env.TENEMENT_KV.list({ prefix: 'member_history:' });

  let totalSessions = 0;
  let completedSessions = 0;
  let totalDonations = 0;
  let activeSessions = 0;

  // Sample recent sessions for stats
  for (const key of sessionList.keys.slice(0, 100)) {
    const raw = await env.TENEMENT_KV.get(key.name);
    if (raw) {
      const session = JSON.parse(raw);
      totalSessions++;
      if (session.completedAt) {
        completedSessions++;
      } else {
        activeSessions++;
      }
      if (session.donated) {
        totalDonations++;
      }
    }
  }

  return jsonResponse({
    success: true,
    stats: {
      totalSessions,
      completedSessions,
      activeSessions,
      totalDonations,
      uniqueMembers: historyList.keys.length,
      sessionKeysTotal: sessionList.keys.length,
      timestamp: new Date().toISOString()
    }
  });
}

// ─── Request handler ──────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET /api/tenement?action=stats&key=SECRET
  if (request.method === 'GET') {
    const action = url.searchParams.get('action');

    if (action === 'stats') {
      return handleStats(request, env);
    }

    return errorResponse('Invalid GET action. Supported: stats', 400);
  }

  // POST /api/tenement
  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return errorResponse('Invalid JSON body');
    }

    const { action } = body;

    switch (action) {
      case 'start':
        return handleStart(body, env);

      case 'scene':
        return handleScene(body, env);

      case 'summary':
        return handleSummary(body, env);

      default:
        return errorResponse('Invalid action. Supported: start, scene, summary');
    }
  }

  return errorResponse('Method not allowed', 405);
}
