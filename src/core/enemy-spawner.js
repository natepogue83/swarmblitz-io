import { consts } from "../../config.js";

// Enemy type definitions with their stats and unlock times
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
		unlockTime: 45,      // Unlocks at 45 seconds
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
		unlockTime: 90,      // Unlocks at 90 seconds
		radius: 18,
		maxHp: 80,
		speed: 30,           // Very slow
		contactDamage: 20,
		spawnWeight: 15
	},
	swarm: {
		unlockTime: 135,     // Unlocks at 135 seconds
		radius: 6,
		maxHp: 8,
		speed: 75,           // Fast
		contactDamage: 4,
		spawnWeight: 60      // Very common when unlocked
	},
	sniper: {
		unlockTime: 180,     // Unlocks at 180 seconds (3 min)
		radius: 9,
		maxHp: 12,
		speed: 40,           // Slow, tries to keep distance
		contactDamage: 5,
		preferredDistance: 250,
		spawnWeight: 20
	}
};

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
		typeUnlockInterval = 45  // New type every 45 seconds
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
	}
	
	reset() {
		this.spawnTimer = 0;
		this.spawnInterval = this.baseInterval;
		this.spawnCountPerWave = this.initialSpawnCount;
		this.runTime = 0;
		this.nextWaveAt = this.waveInterval;
		this.unlockedTypes = ['basic'];
		this.lastUnlockTime = 0;
	}
	
	// Get currently unlocked enemy types
	getUnlockedTypes() {
		return this.unlockedTypes.slice();
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

		if (!player || player.dead) return [];

		const newEnemies = [];
		while (this.spawnTimer >= this.spawnInterval) {
			this.spawnTimer -= this.spawnInterval;
			for (let i = 0; i < this.spawnCountPerWave; i++) {
				const spawn = this.getSpawnPoint(player, mapSize);
				if (spawn) {
					// Select enemy type based on weights
					spawn.type = this.selectEnemyType();
					newEnemies.push(spawn);
				}
			}
		}
		return newEnemies;
	}
	
	checkTypeUnlocks() {
		// Unlock new types every typeUnlockInterval seconds (max 5 types)
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

	getSpawnPoint(player, mapSize) {
		const viewport = player.viewport || { width: 800, height: 600 };
		const distance = Math.max(viewport.width, viewport.height) / 2 + this.spawnMargin;
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
