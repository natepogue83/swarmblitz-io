export default class Enemy {
	constructor({
		id,
		x = 0,
		y = 0,
		vx = 0,
		vy = 0,
		radius = 10,
		maxHp = 20,
		hp = maxHp,
		contactDamage = 8,
		speed = 55,
		lastHitAt = 0,
		type = "basic",
		xpDropValue = 1
	} = {}) {
		this.id = id;
		this.x = x;
		this.y = y;
		this.vx = vx;
		this.vy = vy;
		this.radius = radius;
		this.maxHp = maxHp;
		this.hp = hp;
		this.contactDamage = contactDamage;
		this.speed = speed;
		this.lastHitAt = lastHitAt;
		this.type = type;
		this.xpDropValue = xpDropValue;
	}

	applyKnockback(dx, dy) {
		this.vx += dx;
		this.vy += dy;
	}

	serialData() {
		return {
			id: this.id,
			x: this.x,
			y: this.y,
			vx: this.vx,
			vy: this.vy,
			radius: this.radius,
			hp: this.hp,
			maxHp: this.maxHp,
			contactDamage: this.contactDamage,
			speed: this.speed,
			lastHitAt: this.lastHitAt,
			type: this.type,
			xpDropValue: this.xpDropValue
		};
	}
}
