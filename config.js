// Shared config between the client, server simulation, and Cloudflare Worker.
// NOTE: `tools/*load-test*.js` updates some numeric fields in-place via regex.

export const config = {
  // Client-side config flags
  dev: true,
  port: 8083,
  wsPath: "/ws",
  fps: 60,
  serverTickRate: 60,
  netTickRate: 60,
  prod: false,

  // Server-side bot count (used by the Worker Durable Object)
  bots: 30,
};

export const consts = {
  GRID_COUNT: 100, // Map size in cells (for coordinate scaling)
  CELL_WIDTH: 40, // Size of each cell in pixels
  SPEED: 4, // Player movement speed per frame
  BORDER_WIDTH: 20, // Border around the map
  MAX_PLAYERS: 40, // Maximum players in a game
  NEW_PLAYER_LAG: 60, // Frames to wait before player can move
  LEADERBOARD_NUM: 5, // Number of players shown on leaderboard
  MIN_SNIP_TIME: 1.5,
  MAX_SNIP_TIME: 8.0,
  SAFETY_SPEED_ESTIMATE_MULT: 0.9,
  SNIP_FUSE_SPEED_MULT: 1.5,
  // Exponential fuse ramp: v(t)=v0*exp(k*t). Lower k = slower ramp.
  // 25% slower than prior default.
  SNIP_EXP_ACCEL_PER_SEC: 0.6375,
  // Cap fuse speed as a multiple of the player's current effective speed (generous).
  SNIP_FUSE_MAX_SPEED_MULT: 6.0,
  // Grace period before fuse starts moving (seconds)
  SNIP_GRACE_PERIOD: 0.25,
  PREFIXES:
    "Angry Baby Crazy Diligent Excited Fat Greedy Hungry Interesting Japanese Kind Little Magic Naïve Old Powerful Quiet Rich Superman THU Undefined Valuable Wifeless Xiangbuchulai Young Zombie",
  NAMES:
    "Alice Bob Carol Dave Eve Francis Grace Hans Isabella Jason Kate Louis Margaret Nathan Olivia Paul Queen Richard Susan Thomas Uma Vivian Winnie Xander Yasmine Zach",
  MAX_COINS: 200,
  COIN_SPAWN_INTERVAL_SEC: 2.5,
  COIN_RADIUS: 8,
  COIN_VALUE: 5,
  COIN_DROP_PERCENT: 0.15, // Percentage of XP dropped as loot on death
  KILLER_XP_PERCENT: 0.15, // Percentage of XP transferred directly to killer
  COIN_DROP_MIN: 10, // Minimum XP dropped on death (even if broke)
  KILLER_XP_MIN: 20, // Minimum XP given to killer
  COINS_PER_AREA_UNIT: 0.00025,

  // ===== TRAIL SPEED BUFF =====
  // When players leave their territory, they gain speed over time (risk/reward)
  TRAIL_SPEED_BUFF_MAX: 1.6, // Maximum speed multiplier when trailing
  TRAIL_SPEED_BUFF_RAMP_TIME: 8, // Seconds to reach max speed buff
  TRAIL_SPEED_BUFF_EASE: 2, // Easing exponent

  // ===== XP / LEVELING SYSTEM =====
  XP_BASE_PER_LEVEL: 10, // Base XP needed to level up
  XP_INCREMENT_PER_LEVEL: 15, // XP cost increases by this * level each level
  PLAYER_SIZE_SCALE_PER_LEVEL: 0.04, // Size increase per level
  PLAYER_SIZE_SCALE_MAX: 1.75, // Maximum size multiplier

  // ===== COMBAT SYSTEM =====
  PLAYER_MAX_HP: 100,
  PLAYER_HP_REGEN_IN_TERRITORY: 30, // HP per second when in own territory
  TERRITORY_DAMAGE_REDUCTION: 0.2, // Damage reduction when in own territory

  // ===== DRONE SYSTEM =====
  MAX_DRONES: 10,
  DRONE_ORBIT_RADIUS: 55,
  DRONE_ORBIT_SPEED: 2,
  DRONE_RADIUS: 10,
  DRONE_DAMAGE: 5,
  DRONE_DAMAGE_EXTRA_MULT: 0.5,
  DRONE_DAMAGE_DECAY_FACTOR: 0.75,
  DRONE_RANGE: 158,
  DRONE_COOLDOWN: 0.1,
  DRONE_UPDATE_EVERY_TICKS: 1,

  // ===== AREA OF INTEREST (AOI) OPTIMIZATION =====
  AOI_MIN_RADIUS: 400,
  AOI_BUFFER: 300,
  AOI_HYSTERESIS: 200,
  AOI_GRID_SIZE: 200,
};
