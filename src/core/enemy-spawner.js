import { consts } from "../../config.js";

// Enemy type definitions with their stats and unlock times
// Unlock schedule: 0s, 15s, 35s (15+20), 60s (35+25), 90s (60+30)
export const ENEMY_TYPES = {
	basic: {
		unlockTime: 0,       // Available from start
		radius: 10,
		maxHp: 20,
		speed: 55,
		contactDamage: 8,
		spawnWeight: 50      // Higher = more common
	},
	charger: {
		unlockTime: 15,      // Unlocks at 15 seconds
		radius: 12,
		maxHp: 15,
		speed: 45,           // Base speed (slower), but charges fast
		contactDamage: 15,
		chargeSpeed: 200,    // Speed when charging
		chargeCooldown: 3,   // Seconds between charges
		chargeDistance: 180, // Distance to trigger charge
		spawnWeight: 30
	},
	tank: {
		unlockTime: 35,      // Unlocks at 35 seconds (15+20)
		radius: 18,
		maxHp: 80,
		speed: 30,           // Very slow
		contactDamage: 20,
		spawnWeight: 15
	},
	swarm: {
		unlockTime: 60,      // Unlocks at 60 seconds (35+25)
		radius: 6,
		maxHp: 8,
		speed: 75,           // Fast
		contactDamage: 4,
		spawnWeight: 60      // Very common when unlocked
	},
	sniper: {
		unlockTime: 90,      // Unlocks at 90 seconds (60+30)
		radius: 9,
		maxHp: 12,
		speed: 40,           // Moves to maintain distance
		contactDamage: 5,
		preferredDistance: 200,  // Distance it tries to maintain from player
		spawnWeight: 20
	}
};

// Boss type definitions
export const BOSS_TYPES = {
	titan: {
		// Giant slow boss with massive HP
		radius: 40,
		maxHp: 500,
		speed: 20,
		contactDamage: 35,
		spawnWeight: 40
	},
	berserker: {
		// Medium boss that charges repeatedly
		radius: 28,
		maxHp: 300,
		speed: 35,
		contactDamage: 25,
		chargeSpeed: 250,
		chargeCooldown: 2,
		chargeDistance: 250,
		spawnWeight: 35
	},
	summoner: {
		// Boss that spawns minions
		radius: 32,
		maxHp: 350,
		speed: 25,
		contactDamage: 15,
		summonCooldown: 4,    // Seconds between summons
		summonCount: 3,       // Enemies spawned per summon
		preferredDistance: 300, // Tries to stay away
		spawnWeight: 25
	}
};

const BOSS_NAMES = ['titan', 'berserker', 'summoner'];

// Order of enemy type unlocks
const UNLOCK_ORDER = ['basic', 'charger', 'tank', 'swarm', 'sniper'];
const MAX_TYPES = 5;

export default class EnemySpawner {
	constructor({
		baseInterval = 1.25,
		minInterval = 0.25,
		rampDuration = 120,
		waveInterval = 20,
		initialSpawnCount = 1,
		spawnMargin = 120,
		typeUnlockInterval = 45,
		// Boss settings
		initialBossInterval = 60,   // First boss spawns at 60s, then every 60s
		minBossInterval = 12,       // At 5 min, bosses spawn every ~12s
		bossRampDuration = 300      // 5 minutes to reach min interval
	} = {}) {
		this.spawnTimer = 0;
		this.spawnInterval = baseInterval;
		this.baseInterval = baseInterval;
		this.minInterval = minInterval;
		this.rampDuration = rampDuration;
		this.waveInterval = waveInterval;
		this.initialSpawnCount = initialSpawnCount;
		this.spawnCountPerWave = initialSpawnCount;
		this.spawnMargin = spawnMargin;
		this.typeUnlockInterval = typeUnlockInterval;
		this.runTime = 0;
		this.nextWaveAt = waveInterval;
		this.unlockedTypes = ['basic'];
		this.lastUnlockTime = 0;
		
		// Boss spawning
		this.initialBossInterval = initialBossInterval;
		this.minBossInterval = minBossInterval;
		this.bossRampDuration = bossRampDuration;
		this.bossTimer = 0;
		this.nextBossAt = initialBossInterval; // First boss at 60s
		this.bossesSpawned = 0;
	}
	
	reset() {
		this.spawnTimer = 0;
		this.spawnInterval = this.baseInterval;
		this.spawnCountPerWave = this.initialSpawnCount;
		this.runTime = 0;
		this.nextWaveAt = this.waveInterval;
		this.unlockedTypes = ['basic'];
		this.lastUnlockTime = 0;
		
		// Reset boss state
		this.bossTimer = 0;
		this.nextBossAt = this.initialBossInterval;
		this.bossesSpawned = 0;
	}
	
	// Get currently unlocked enemy types
	getUnlockedTypes() {
		return this.unlockedTypes.slice();
	}
	
	// Get current boss spawn interval
	getBossInterval() {
		const rampT = Math.min(1, this.runTime / this.bossRampDuration);
		return this.initialBossInterval - (this.initialBossInterval - this.minBossInterval) * rampT;
	}

	update(deltaSeconds, player, mapSize) {
		this.runTime += deltaSeconds;
		this.spawnTimer += deltaSeconds;

		const rampT = Math.min(1, this.runTime / this.rampDuration);
		this.spawnInterval = this.baseInterval - (this.baseInterval - this.minInterval) * rampT;

		if (this.runTime >= this.nextWaveAt) {
			this.spawnCountPerWave += 1;
			this.nextWaveAt += this.waveInterval;
		}
		
		// Check for new enemy type unlocks
		this.checkTypeUnlocks();

		if (!player || player.dead) return { enemies: [], bosses: [] };

		const newEnemies = [];
		const newBosses = [];
		
		// Regular enemy spawning
		while (this.spawnTimer >= this.spawnInterval) {
			this.spawnTimer -= this.spawnInterval;
			for (let i = 0; i < this.spawnCountPerWave; i++) {
				const spawn = this.getSpawnPoint(player, mapSize);
				if (spawn) {
					spawn.type = this.selectEnemyType();
					newEnemies.push(spawn);
				}
			}
		}
		
		// Boss spawning - check if it's time for a boss
		if (this.runTime >= this.nextBossAt) {
			const bossSpawn = this.getSpawnPoint(player, mapSize, 150); // Spawn further away
			if (bossSpawn) {
				bossSpawn.type = this.selectBossType();
				bossSpawn.isBoss = true;
				newBosses.push(bossSpawn);
				this.bossesSpawned++;
				console.log(`[SPAWNER] Boss spawned: ${bossSpawn.type} (#${this.bossesSpawned}) at ${Math.floor(this.runTime)}s`);
			}
			
			// Calculate next boss spawn time (gets shorter over time)
			const currentInterval = this.getBossInterval();
			this.nextBossAt = this.runTime + currentInterval;
		}
		
		return { enemies: newEnemies, bosses: newBosses };
	}
	
	checkTypeUnlocks() {
		// Unlock new types based on their unlock time
		for (const typeName of UNLOCK_ORDER) {
			if (this.unlockedTypes.includes(typeName)) continue;
			if (this.unlockedTypes.length >= MAX_TYPES) break;
			
			const typeData = ENEMY_TYPES[typeName];
			if (typeData && this.runTime >= typeData.unlockTime) {
				this.unlockedTypes.push(typeName);
				console.log(`[SPAWNER] Unlocked enemy type: ${typeName} at ${Math.floor(this.runTime)}s`);
			}
		}
	}
	
	selectEnemyType() {
		// Weighted random selection from unlocked types
		let totalWeight = 0;
		for (const typeName of this.unlockedTypes) {
			totalWeight += ENEMY_TYPES[typeName].spawnWeight;
		}
		
		let roll = Math.random() * totalWeight;
		for (const typeName of this.unlockedTypes) {
			roll -= ENEMY_TYPES[typeName].spawnWeight;
			if (roll <= 0) {
				return typeName;
			}
		}
		
		return 'basic'; // Fallback
	}
	
	selectBossType() {
		// Weighted random selection from boss types
		let totalWeight = 0;
		for (const bossName of BOSS_NAMES) {
			totalWeight += BOSS_TYPES[bossName].spawnWeight;
		}
		
		let roll = Math.random() * totalWeight;
		for (const bossName of BOSS_NAMES) {
			roll -= BOSS_TYPES[bossName].spawnWeight;
			if (roll <= 0) {
				return bossName;
			}
		}
		
		return 'titan'; // Fallback
	}

	getSpawnPoint(player, mapSize, extraMargin = 0) {
		const viewport = player.viewport || { width: 800, height: 600 };
		const distance = Math.max(viewport.width, viewport.height) / 2 + this.spawnMargin + extraMargin;
		const minDist = (player.getScaledRadius ? player.getScaledRadius() : consts.CELL_WIDTH / 2) + 12;
		const minBound = consts.BORDER_WIDTH;
		const maxBound = mapSize - consts.BORDER_WIDTH;

		for (let attempt = 0; attempt < 8; attempt++) {
			const angle = Math.random() * Math.PI * 2;
			let x = player.x + Math.cos(angle) * distance;
			let y = player.y + Math.sin(angle) * distance;

			x = Math.max(minBound, Math.min(maxBound, x));
			y = Math.max(minBound, Math.min(maxBound, y));

			const dx = x - player.x;
			const dy = y - player.y;
			if (dx * dx + dy * dy >= minDist * minDist) {
				return { x, y };
			}
		}

		const fallbackAngle = Math.random() * Math.PI * 2;
		const fallbackX = Math.max(minBound, Math.min(maxBound, player.x + Math.cos(fallbackAngle) * distance));
		const fallbackY = Math.max(minBound, Math.min(maxBound, player.y + Math.sin(fallbackAngle) * distance));
		return { x: fallbackX, y: fallbackY };
	}
}
