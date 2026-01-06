export const config = {
	"dev": true,
	"port": 8083,
	"bots": 3,
	"fps": 60
};

export const consts = {
	"GRID_COUNT": 100,        // Map size in cells (for coordinate scaling)
	"CELL_WIDTH": 40,         // Size of each cell in pixels
	"SPEED": 4,               // Player movement speed per frame
	"BORDER_WIDTH": 20,       // Border around the map
	"MAX_PLAYERS": 30,        // Maximum players in a game
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
	"COIN_VALUE": 1,
	"COINS_PER_AREA_UNIT": 0.00025
};
