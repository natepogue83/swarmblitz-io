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
	"MAX_STAMINA": 100,
	"STAMINA_DRAIN_OUTSIDE_PER_SEC": 12,
	"STAMINA_REGEN_INSIDE_PER_SEC": 18,
	"EXHAUSTED_SPEED_MULT": 0.55,
	"EXHAUSTED_RECOVER_THRESHOLD": 20,
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
	"XP_PER_LEVEL": 100,              // XP needed to level up (constant per level)
	"PLAYER_SIZE_SCALE_PER_LEVEL": 0.05,  // Size increase per level (5%)
	"PLAYER_SIZE_SCALE_MAX": 1.6,     // Maximum size multiplier
	
	// ===== TURRET SYSTEM =====
	// Player HP (turret damage target)
	"PLAYER_MAX_HP": 100,
	"PLAYER_HP_REGEN_IN_TERRITORY": 15,  // HP per second when in own territory (buffed)
	
	// Ring radii from player's home/core position
	"TURRET_RING1_RADIUS": 200,       // Closest ring (strongest turrets)
	"TURRET_RING2_RADIUS": 400,       // Mid ring
	"TURRET_RING3_RADIUS": 9999,      // Far ring (everything beyond ring 2)
	
	// Spawn settings
	"TURRET_SPAWN_INTERVAL_SEC": 10,  // How often each player spawns a turret (slower)
	"MAX_TURRETS_PER_PLAYER": 10,     // Cap per player (reduced)
	"MIN_TURRET_SPACING": 80,         // Minimum distance between turrets of same owner
	
	// Ring 1 turret stats (strongest) - reduced damage
	"TURRET_RING1_HP": 100,
	"TURRET_RING1_DAMAGE": 5,
	"TURRET_RING1_RANGE": 300,
	"TURRET_RING1_COOLDOWN": 0.8,
	
	// Ring 2 turret stats (medium) - reduced damage
	"TURRET_RING2_HP": 70,
	"TURRET_RING2_DAMAGE": 4,
	"TURRET_RING2_RANGE": 250,
	"TURRET_RING2_COOLDOWN": 1.0,
	
	// Ring 3 turret stats (weakest) - reduced damage
	"TURRET_RING3_HP": 45,
	"TURRET_RING3_DAMAGE": 3,
	"TURRET_RING3_RANGE": 200,
	"TURRET_RING3_COOLDOWN": 1.2,
	
	// Turret visual
	"TURRET_RADIUS": 18,
	
	// Projectile settings
	"PROJECTILE_SPEED": 8,            // Units per frame (at 60fps = 480 units/sec)
	"PROJECTILE_RADIUS": 6,           // Collision radius for hitting players
	"PROJECTILE_MAX_LIFETIME": 3,     // Seconds before projectile despawns
	
	// ===== DRONE SYSTEM =====
	// Note: Drones are now granted automatically via leveling (1 per level)
	"MAX_DRONES": 50,                 // Maximum drones per player (effectively level cap)
	"DRONE_ORBIT_RADIUS": 55,         // Distance from player center
	"DRONE_ORBIT_SPEED": 1.5,         // Radians per second (orbit rotation speed)
	"DRONE_RADIUS": 10,               // Visual/collision radius
	"DRONE_HP": 40,                   // Drone hit points
	"DRONE_DAMAGE": 4,                // Damage per projectile
	"DRONE_RANGE": 200,               // Targeting range
	"DRONE_COOLDOWN": 1.0,            // Seconds between shots
	"DRONE_HP_REGEN_IN_TERRITORY": 8  // HP per second when owner is in safe territory
};
