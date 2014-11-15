var growlMinDelay = 5,
	growlSounds = 3; // in seconds


var Vec2d = require('./util/Vector2d'),
	GameConsts = require('./GameConsts');

var Monster = function(x, y, target) {
	var self = this;
	this.target = target;

	this.radius = 40;
	this.maxHealth = this.health = 300;
	this.id = 'monster';
	this.lastGrowlAt = 0;
	this.growlSoundIndex = 0;
	this.bounceVelocity = new Vec2d(0, 0);

	this.element = new createjs.Container();
	this.velocity = new Vec2d(0, 0);

	var image = new createjs.Bitmap('./img/monster.png');
	this.element.scaleX = this.element.scaleY = 0.18;

	image.image.onload = function() {
		self.element.regX = self.element.getBounds().width / 2;
		self.element.regY = self.element.getBounds().height / 2;
	};

	this.element.x = x;
	this.element.y = y;

	this.element.addChild(image);
};

Monster.prototype.registerEvents = function(emitter) {
	emitter.on('hit', this.onHit.bind(this));
	this.emitter = emitter;
};

Monster.prototype.onHit = function(event) {
	if (event.hitTarget !== this.id) {
		if (event.damageDealer == this.id) {
			var position = new Vec2d(this.element.x, this.element.y);
			var target_position = new Vec2d(this.target.element.x, this.target.element.y);
			this.target.bounceVelocity =  Vec2d.subtract(target_position, position).norm().times(180);
		}

		return;
	}

	this.bounceVelocity = this.velocity.clone().norm().times(-180);

	this.health -= event.damage;
	this.health = Math.max(0, this.health);

	if (this.health == 0) {
		this.emitter.emit('monster-dead');
	}
};

/**
 * @param event
 */
Monster.prototype.tick = function(event) {
	var current = new Vec2d(this.target.element.x, this.target.element.y);
	var target = new Vec2d(this.element.x, this.element.y);

	var vector_to_destination = Vec2d.subtract(current, target);
	var distance = vector_to_destination.length()

	// calculate new velocity according to current velocity and position of target
	vector_to_destination.norm().times(0.5);
	this.velocity.norm().times(20);
	this.velocity = this.velocity.plus(vector_to_destination)

	// set speed of monster according to distance to target
	this.velocity.times(distance);

	var delta = Vec2d.multiply(this.velocity, event.delta / 1000 * GameConsts.MONSTER_SPEED);
	var angle = Vec2d.getAngle(delta);

	if (this.bounceVelocity.length() != 0) {
		var push_delta = Vec2d.multiply(this.bounceVelocity.clone(), event.delta / 80);
		this.bounceVelocity = this.bounceVelocity.minus(push_delta);

		delta.plus(push_delta);

		if (push_delta.length() < 1) {
			this.bounceVelocity = new Vec2d(0, 0);
		}
	}

	this.element.x += delta.x;
	this.element.y += delta.y;

	this.element.rotation = angle;

	if (event.timeStamp - this.lastGrowlAt > growlMinDelay * 1000) {
		this.growl();
	}
};

Monster.prototype.growl = function() {
	this.lastGrowlAt = new Date().getTime();
	createjs.Sound.play('growl' + this.growlSoundIndex);
	this.growlSoundIndex = (this.growlSoundIndex + 1) % growlSounds;

	this.emitter.emit('growl', {
		x: this.element.x,
		y: this.element.y,
		rotation: this.element.rotation
	});
};

Monster.prototype.getRadius = function() {
	return this.radius;
};

Monster.prototype.isShortAttacking = function() {
	return false;
};

module.exports = Monster;
