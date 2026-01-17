export const config = {
	"dev": true,
	"port": 8083,
	"wsPath": "/ws",
	"fps": 60,
	"serverTickRate": 60,
	"netTickRate": 60,
	"prod": false
};

export const consts = {
	"GRID_COUNT": 100,        // Map size in cells (for coordinate scaling)
	"CELL_WIDTH": 40,         // Size of each cell in pixels
	"SPEED": 4,               // Player movement speed per frame
	"BORDER_WIDTH": 20,       // Border around the map
	"MAX_PLAYERS": 100,        // Maximum players in a game
	"NEW_PLAYER_LAG": 60,     // Frames to wait before player can move
	"LEADERBOARD_NUM": 5,     // Number of players shown on leaderboard
	"MIN_SNIP_TIME": 1.5,
	"MAX_SNIP_TIME": 8.0,
	"SAFETY_SPEED_ESTIMATE_MULT": 0.9,
	"SNIP_FUSE_SPEED_MULT": 1.5,
	// Exponential fuse ramp: v(t)=v0*exp(k*t). Lower k = slower ramp.
	// 25% slower than prior default.
	"SNIP_EXP_ACCEL_PER_SEC": 0.6375,
	// Cap fuse speed as a multiple of the player's current effective speed (generous).
	"SNIP_FUSE_MAX_SPEED_MULT": 6.0,
	// Grace period before fuse starts moving (seconds)
	"SNIP_GRACE_PERIOD": 0.25,
	"PREFIXES": "Angry Baby Crazy Diligent Excited Fat Greedy Hungry Interesting Japanese Kind Little Magic Naïve Old Powerful Quiet Rich Superman THU Undefined Valuable Wifeless Xiangbuchulai Young Zombie",
	"NAMES": "Alice Bob Carol Dave Eve Francis Grace Hans Isabella Jason Kate Louis Margaret Nathan Olivia Paul Queen Richard Susan Thomas Uma Vivian Winnie Xander Yasmine Zach",
	"MAX_COINS": 200,
	"COIN_SPAWN_INTERVAL_SEC": 0.5,
	"COIN_RADIUS": 8,
	"XP_ORB_PULL_SPEED_MULT": 1.2,   // Enemy XP orb pull speed in territory
	"XP_ORB_PULL_ACCEL_MULT": 1.25,   // Accel rate toward max pull speed
	
	// ===== STAMINA/HEAL BOOST ORBS =====
	"STAMINA_BOOST_AMOUNT": 20,         // Stamina granted on pickup
	"HEAL_BOOST_BASE": 20,              // Base heal amount (scaled by minutes+1)
	"BOOST_SPAWN_RADIUS": 600,          // Spawn distance from player
	"BOOST_SPAWN_MIN_DIST": 200,        // Minimum spawn distance from player
	"BOOST_SPAWN_INTERVAL_SEC": 2.0,    // Seconds between boost orb spawn attempts
	"MAX_BOOST_ORBS": 10,               // Maximum stamina/heal boosts at once
	"BOOST_ORB_LIFETIME_SEC": 15,       // Seconds before boost orbs disappear
	"BOOST_ORB_BLINK_TIME": 3,          // Seconds before disappearing when orb blinks
	
	// ===== XP VALUES (Easy tuning knobs) =====
	"COIN_VALUE": 10,                   // XP from picking up world coins (gold orbs)
	"ENEMY_XP_DROP_VALUE": 3,          // XP from picking up enemy death drops (red orbs)
	"XP_ORB_LIFETIME_SEC": 30,         // Seconds before enemy XP orbs disappear (0 = never)
	"TERRITORY_XP_PER_AREA": 0.00018,  // XP gained per unit of area captured (territory)
	"TERRITORY_XP_SCALE": .55,         // Simple multiplier for territory XP (1.0 = default, 2.0 = double, 0.5 = half)
	"TERRITORY_XP_SCALE_CAP_MIN": 5,  // Minutes after which territory XP stops scaling with level (0 = no cap)
	
	// ===== DEATH XP TRANSFER =====
	"COIN_DROP_PERCENT": 0.15,         // Percentage of XP dropped as loot on death
	"KILLER_XP_PERCENT": 0.15,         // Percentage of XP transferred directly to killer
	"COIN_DROP_MIN": 10,               // Minimum XP dropped on death (even if broke)
	"KILLER_XP_MIN": 20,               // Minimum XP given to killer
	
	// ===== TRAIL SPEED BUFF =====
	// When players leave their territory, they gain speed over time (risk/reward)
	"TRAIL_SPEED_BUFF_MAX": 1.2,        // Maximum speed multiplier when trailing (1.5 = 50% faster)
	"TRAIL_SPEED_BUFF_RAMP_TIME": 2,  // Seconds to reach max speed buff
	"TRAIL_SPEED_BUFF_EASE": 2,       // Easing exponent (1 = linear, 2 = quadratic ease-in, higher = slower start)
	
	// ===== XP / LEVELING SYSTEM =====
	"XP_BASE_PER_LEVEL": 35,         // Base XP needed to level up (level 1 → 2)
	"XP_GROWTH_RATE": 1.13,          // Exponential growth rate per level
	// Formula: XP needed for level L = BASE * (GROWTH_RATE ^ (L - 1))
	// Level 1→2: 25, Level 2→3: 29, Level 3→4: 33, etc.
	"PLAYER_SIZE_SCALE_PER_LEVEL": 0.01,  // Size increase per level (1%)
	"PLAYER_SIZE_SCALE_MAX": 1.6,     // Maximum size multiplier
	"ZOOM_SCALE_RATE": 0.2,           // How much zoom scales with size (0 = no zoom, 1 = full zoom)
	
	// ===== COMBAT SYSTEM =====
	// Player HP (for drone combat)
	"PLAYER_MAX_HP": 50,
	"HP_PER_LEVEL": 10,                  // Max HP gained per level up
	"PLAYER_HP_REGEN_IN_TERRITORY": 15,  // HP per second when in own territory (fast regen)
	"TERRITORY_DAMAGE_REDUCTION": 0.30,   // Damage reduction when in own territory (0.5 = 50% less damage)
	"TERRITORY_SHRINK_IN_TERRITORY_PER_SEC": 0.005, // Territory shrink rate when inside (1% per sec)
	
	// ===== STAMINA SYSTEM =====
	// Stamina drains when outside territory; HP drains when stamina is empty
	"PLAYER_MAX_STAMINA": 100,              // Maximum stamina
	"STAMINA_DRAIN_OUTSIDE_PER_SEC": 15,    // Stamina drain rate outside territory (~10 sec to empty)
	"STAMINA_HP_DRAIN_PER_SEC": 25,          // HP drain rate when stamina is empty
	"STAMINA_REGEN_INSIDE_PER_SEC": 75,     // Stamina regen rate inside territory
	"EXHAUSTED_RECOVER_THRESHOLD": 20,      // Stamina needed to recover from exhausted state
	
	// ===== DRONE SYSTEM =====
	// Note: Drones are now granted automatically via leveling
	// Drones use hitscan - instant damage when they fire
	"MAX_DRONES": 9,                 // Maximum drones per player (effectively level cap)
	"DRONE_LEVEL_INTERVAL": 4,        // Gain 1 drone every N levels
	"DRONE_ORBIT_RADIUS": 45,         // Distance from player center
	"DRONE_ORBIT_SPEED": 2,         // Radians per second (orbit rotation speed)
	"DRONE_RADIUS": 12,               // Visual/collision radius
	"DRONE_DAMAGE": 25,               // Damage for first drone (hitscan)
	"DRONE_DAMAGE_EXTRA_MULT": 1,   // Damage multiplier for 2nd drone (relative to 1st)
	"DRONE_DAMAGE_DECAY_FACTOR": .95,  // Damage multiplier for each drone after the 2nd (e.g., 0.8 = 20% reduction per drone)
	"DRONE_RANGE": 158,               // Targeting range (reduced 30% from 225)
	"DRONE_COOLDOWN": .5,             // Seconds between shots
	"DRONE_UPDATE_EVERY_TICKS": 1,    // Throttle drone updates sent to clients (1 = every tick)
	
	// ===== ENEMY SPAWN BOOST =====
	"ENEMY_SPAWN_BOOST_DURATION": 15, // Seconds of boosted spawns after a boss spawns
	"ENEMY_SPAWN_BOOST_MULT": 0.4,    // Spawn interval multiplier during boost (lower = faster)
	"ENEMY_LIFETIME_SECONDS": 15,     // Despawn non-boss enemies after inactivity
	"ENEMY_DESPAWN_DISTANCE": 1300,  // Only despawn when this far from player
	
	// ===== HEAL PACKS (Support drone passive) =====
	"HEAL_PACK_LIFETIME": 20,         // Seconds before heal pack disappears
	"HEAL_PACK_BLINK_TIME": 5,        // Seconds before disappearing when pack starts blinking
	"HEAL_PACK_RADIUS": 12,           // Pickup radius for heal packs
	
	// ===== ENEMY STATUS EFFECTS =====
	"SLOW_DURATION_DEFAULT": 1.5,     // Default slow duration in seconds
	"BLEED_TICK_RATE": 0.25,          // Bleed ticks every 0.25 seconds (4 times per second)
	
	// ===== AREA OF INTEREST (AOI) OPTIMIZATION =====
	// Reduces bandwidth from O(N²) to O(N×K) where K = avg nearby players
	// AOI radius is now DYNAMIC based on each player's viewport size
	"AOI_MIN_RADIUS": 400,           // Minimum AOI radius (for very small windows)
	"AOI_BUFFER": 900,               // Extra buffer beyond viewport edge (ensures off-screen spawn)
	"AOI_HYSTERESIS": 900,           // Extra buffer before removing from AOI (prevents flicker)
	"AOI_GRID_SIZE": 200             // Spatial grid cell size for efficient queries
};
