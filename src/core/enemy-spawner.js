import { consts } from "../../config.js";
import { ENEMY_TYPES, BOSS_TYPES, ENEMY_SPAWN_RATE, ENEMY_TYPE_WEIGHTING } from "./enemy-knobs.js";

export { ENEMY_TYPES, BOSS_TYPES };

const BOSS_NAMES = ['titan', 'berserker', 'summoner'];

// Order of enemy type unlocks (exclude swarm: minion-only)
const UNLOCK_ORDER = ['basic', 'charger', 'tank', 'sniper'];
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
		minBossInterval = 10,       // At 5 min, bosses spawn every ~12s
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
		
		// Temporary spawn boost after boss spawns
		this.spawnBoostDuration = consts.ENEMY_SPAWN_BOOST_DURATION ?? 15;
		this.spawnBoostMult = consts.ENEMY_SPAWN_BOOST_MULT ?? 0.6;
		this.spawnBoostRemaining = 0;
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
		
		// Reset spawn boost
		this.spawnBoostRemaining = 0;
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
		if (this.spawnBoostRemaining > 0) {
			this.spawnBoostRemaining = Math.max(0, this.spawnBoostRemaining - deltaSeconds);
		}

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
		
		// Regular enemy spawning (apply global spawn rate multiplier)
		const effectiveInterval = (this.spawnInterval * (this.spawnBoostRemaining > 0 ? this.spawnBoostMult : 1)) / ENEMY_SPAWN_RATE.multiplier;
		while (this.spawnTimer >= effectiveInterval) {
			this.spawnTimer -= effectiveInterval;
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
				
				// Activate spawn boost
				this.spawnBoostRemaining = this.spawnBoostDuration;
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
		const weighting = ENEMY_TYPE_WEIGHTING || {};
		const minutes = this.runTime / 60;
		const perMinute = weighting.perMinute ?? 0;
		const maxBonus = weighting.maxBonus ?? 0;
		const useWeighting = weighting.enabled && perMinute > 0 && maxBonus > 0;

		let totalWeight = 0;
		for (const typeName of this.unlockedTypes) {
			const baseWeight = ENEMY_TYPES[typeName].spawnWeight;
			if (!useWeighting) {
				totalWeight += baseWeight;
				continue;
			}

			const typeIndex = UNLOCK_ORDER.indexOf(typeName);
			const difficultyFactor = Math.max(0, typeIndex) / Math.max(1, MAX_TYPES - 1);
			const bonus = Math.min(maxBonus, minutes * perMinute * difficultyFactor);
			totalWeight += baseWeight * (1 + bonus);
		}
		
		let roll = Math.random() * totalWeight;
		for (const typeName of this.unlockedTypes) {
			const baseWeight = ENEMY_TYPES[typeName].spawnWeight;
			if (!useWeighting) {
				roll -= baseWeight;
				if (roll <= 0) {
					return typeName;
				}
				continue;
			}

			const typeIndex = UNLOCK_ORDER.indexOf(typeName);
			const difficultyFactor = Math.max(0, typeIndex) / Math.max(1, MAX_TYPES - 1);
			const bonus = Math.min(maxBonus, minutes * perMinute * difficultyFactor);
			roll -= baseWeight * (1 + bonus);
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
