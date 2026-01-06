
You are working in our current repo, which is essentially a working Paper.io 2-style multiplayer clone with freeform paths and correct territory capture. Do NOT change territory capture, trail fill, collision math, or networking architecture beyond what is required to transmit new player stats.

Task: Add a server-authoritative STAMINA system with minimal UI.

Constraints:
- Treat the territory/trail system as a black box that already works.
- Keep changes small and localized.
- All stamina calculations happen on the server each tick; the client only displays values.
- Do not add panic mode, coins, shop, turrets, drones, PvE, or new death rules in this change.

Design (Stamina v1):
Player fields (server-owned):
- stamina (number)
- maxStamina (number)
- isExhausted (boolean)

Config constants (one place, easy to tune):
- MAX_STAMINA (e.g. 100)
- STAMINA_DRAIN_OUTSIDE_PER_SEC (e.g. 12)
- STAMINA_REGEN_INSIDE_PER_SEC (e.g. 18)
- EXHAUSTED_SPEED_MULT (e.g. 0.55)
- EXHAUSTED_RECOVER_THRESHOLD (e.g. 0.2 * MAX_STAMINA)

Definitions:
- "Inside territory" = player is currently within their OWNED area (the same condition the game already uses to determine they are not drawing a trail / are safe).
- "Outside territory" = player is not inside their OWNED area (the same condition that currently causes trail drawing).

Rules:
1) Inside territory:
   - stamina increases by STAMINA_REGEN_INSIDE_PER_SEC * deltaSeconds, clamped to MAX_STAMINA.
2) Outside territory:
   - stamina decreases by STAMINA_DRAIN_OUTSIDE_PER_SEC * deltaSeconds, clamped to 0.
3) Exhaustion:
   - When stamina reaches 0, set isExhausted = true.
   - While exhausted, movement speed is multiplied by EXHAUSTED_SPEED_MULT.
   - Exhaustion clears when stamina rises above EXHAUSTED_RECOVER_THRESHOLD (e.g. 20% max).
4) Stamina does NOT cause death. It only affects movement speed.

Implementation steps:
A) Locate the player model/entity on the server and add stamina fields with sensible initialization:
   - stamina = MAX_STAMINA
   - maxStamina = MAX_STAMINA
   - isExhausted = false

B) Locate the main server update loop / tick step.
   - Determine deltaSeconds (time step) already used.
   - Determine whether player is inside vs outside using existing game state:
     - Prefer an existing boolean/flag like `player.isInTerritory`, `player.isOutside`, `player.isDrawingTrail`, etc.
     - If not present, reuse the existing point-in-owned-area check the server already uses.

C) Add a stamina update function on the server:
   - updateStamina(player, deltaSeconds, isInsideTerritory)
   - clamp stamina
   - handle isExhausted transitions

D) Apply speed modifier:
   - Do not rewrite movement logic.
   - Introduce a single speedMultiplier variable in player movement update, default 1.0.
   - If player.isExhausted, speedMultiplier = EXHAUSTED_SPEED_MULT.
   - Multiply current movement speed by speedMultiplier.

E) Networking:
   - Add stamina data to whatever snapshot/state update object is sent to the client:
     - stamina
     - maxStamina
     - isExhausted (optional, but preferred)

F) Client UI (minimal):
   - Render a stamina bar (simple rectangle) in a corner:
     - width proportional to stamina/maxStamina
   - When exhausted, show a small warning text: "EXHAUSTED" (or change bar style).
   - Do not add art polish; just readable debugging UI.

Testing checklist:
- Stand inside owned territory: stamina refills to max.
- Leave territory and keep moving outside: stamina drains to 0.
- At stamina 0: movement speed visibly reduces.
- Re-enter territory: stamina refills; once above threshold, speed returns to normal.
- No changes in territory behavior, capture behavior, or trail rules.
