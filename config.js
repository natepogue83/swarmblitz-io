export const config = {
	"dev": true,
	"port": 8083,
	"wsPath": "/ws",
	"bots": 30,
	"fps": 60,
	"serverTickRate": 60,
	"netTickRate": 10, // Network updates per second (server->client)
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
	"COIN_SPAWN_INTERVAL_SEC": 2.5,
	"COIN_RADIUS": 8,
	"COIN_VALUE": 5,
	"COIN_DROP_PERCENT": 0.15,         // Percentage of XP dropped as loot on death
	"KILLER_XP_PERCENT": 0.15,         // Percentage of XP transferred directly to killer
	"COIN_DROP_MIN": 10,               // Minimum XP dropped on death (even if broke)
	"KILLER_XP_MIN": 20,               // Minimum XP given to killer
	"COINS_PER_AREA_UNIT": 0.00025,
	
	// ===== TRAIL SPEED BUFF =====
	// When players leave their territory, they gain speed over time (risk/reward)
	"TRAIL_SPEED_BUFF_MAX": 1.4,        // Maximum speed multiplier when trailing (1.5 = 50% faster)
	"TRAIL_SPEED_BUFF_RAMP_TIME": 5,  // Seconds to reach max speed buff
	"TRAIL_SPEED_BUFF_EASE": 2,       // Easing exponent (1 = linear, 2 = quadratic ease-in, higher = slower start)
	
	// ===== XP / LEVELING SYSTEM =====
	"XP_BASE_PER_LEVEL": 100,         // Base XP needed to level up (level 1 → 2)
	"XP_INCREMENT_PER_LEVEL": 25,    // XP cost increases by this * level each level
	// Formula: XP needed for level L = BASE + (L-1) * INCREMENT
	// Level 1→2: 50, Level 2→3: 65, Level 3→4: 80, etc.
	"PLAYER_SIZE_SCALE_PER_LEVEL": 0.04,  // Size increase per level (5%)
	"PLAYER_SIZE_SCALE_MAX": 1.75,     // Maximum size multiplier
	
	// ===== COMBAT SYSTEM =====
	// Player HP (for drone combat)
	"PLAYER_MAX_HP": 100,
	"PLAYER_HP_REGEN_IN_TERRITORY": 50,  // SHP per second when in own territory (fast regen)
	"TERRITORY_DAMAGE_REDUCTION": 0.5,   // Damage reduction when in own territory (0.5 = 50% less damage)
	
	// ===== DRONE SYSTEM =====
	// Note: Drones are now granted automatically via leveling (1 per level)
	// Drones use hitscan - instant damage when they fire
	"MAX_DRONES": 50,                 // Maximum drones per player (effectively level cap)
	"DRONE_ORBIT_RADIUS": 55,         // Distance from player center
	"DRONE_ORBIT_SPEED": 2,         // Radians per second (orbit rotation speed)
	"DRONE_RADIUS": 10,               // Visual/collision radius
	"DRONE_DAMAGE": 5,               // Damage for first drone (hitscan)
	"DRONE_DAMAGE_EXTRA_MULT": 0.5,   // Damage multiplier for 2nd drone (relative to 1st)
	"DRONE_DAMAGE_DECAY_FACTOR": 0.75,  // Damage multiplier for each drone after the 2nd (e.g., 0.8 = 20% reduction per drone)
	"DRONE_RANGE": 158,               // Targeting range (reduced 30% from 225)
	"DRONE_COOLDOWN": .1,             // Seconds between shots
	"DRONE_UPDATE_EVERY_TICKS": 1,    // Send drone updates every tick for smooth visuals
	
	// ===== AREA OF INTEREST (AOI) OPTIMIZATION =====
	// Reduces bandwidth from O(N²) to O(N×K) where K = avg nearby players
	// AOI radius is now DYNAMIC based on each player's viewport size
	"AOI_MIN_RADIUS": 400,           // Minimum AOI radius (for very small windows)
	"AOI_BUFFER": 300,               // Extra buffer beyond viewport edge (ensures off-screen spawn)
	"AOI_HYSTERESIS": 200,           // Extra buffer before removing from AOI (prevents flicker)
	"AOI_GRID_SIZE": 200             // Spatial grid cell size for efficient queries
};
