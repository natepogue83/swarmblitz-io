export const config = {
	"dev": true,
	"port": 8083,
	"bots": 30,
	"fps": 60
};

export const consts = {
	"GRID_COUNT": 100,        // Map size in cells (for coordinate scaling)
	"CELL_WIDTH": 40,         // Size of each cell in pixels
	"SPEED": 4,               // Player movement speed per frame
	"BORDER_WIDTH": 20,       // Border around the map
	"MAX_PLAYERS": 100,        // Maximum players in a game
	"NEW_PLAYER_LAG": 30,     // Frames to wait before player can move
	"LEADERBOARD_NUM": 5,     // Number of players shown on leaderboard
	"MIN_SNIP_TIME": 2.0,
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
	"COIN_DROP_PERCENT": 0.63,         // Percentage of held XP dropped on death
	"COIN_DROP_MIN": 10,               // Minimum XP dropped on death (even if broke)
	"COINS_PER_AREA_UNIT": 0.00025,
	
	// ===== XP / LEVELING SYSTEM =====
	"XP_BASE_PER_LEVEL": 50,         // Base XP needed to level up (level 1 → 2)
	"XP_INCREMENT_PER_LEVEL": 20,    // XP cost increases by this * level each level
	// Formula: XP needed for level L = BASE + (L-1) * INCREMENT
	// Level 1→2: 50, Level 2→3: 65, Level 3→4: 80, etc.
	"PLAYER_SIZE_SCALE_PER_LEVEL": 0.05,  // Size increase per level (5%)
	"PLAYER_SIZE_SCALE_MAX": 1.6,     // Maximum size multiplier
	
	// ===== COMBAT SYSTEM =====
	// Player HP (for drone combat)
	"PLAYER_MAX_HP": 100,
	"PLAYER_HP_REGEN_IN_TERRITORY": 50,  // SHP per second when in own territory (fast regen)
	"TERRITORY_DAMAGE_REDUCTION": 0.7,   // Damage reduction when in own territory (0.5 = 50% less damage)
	
	// ===== DRONE SYSTEM =====
	// Note: Drones are now granted automatically via leveling (1 per level)
	// Drones use hitscan - instant damage when they fire
	"MAX_DRONES": 50,                 // Maximum drones per player (effectively level cap)
	"DRONE_ORBIT_RADIUS": 55,         // Distance from player center
	"DRONE_ORBIT_SPEED": 2,         // Radians per second (orbit rotation speed)
	"DRONE_RADIUS": 10,               // Visual/collision radius
	"DRONE_DAMAGE": 5,               // Damage for first drone (hitscan)
	"DRONE_DAMAGE_EXTRA": .5,          // Damage for additional drones (diminishing returns)
	"DRONE_RANGE": 225,               // Targeting range (increased for better engagement)
	"DRONE_COOLDOWN": .2             // Seconds between shots
};
