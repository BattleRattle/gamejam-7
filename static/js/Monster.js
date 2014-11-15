
var Vec2d = require('./util/Vector2d');

var Monster = function(x, y, target) {
	var self = this;
	this.target = target;

	this.radius = 30;
	this.maxHealth = this.health = 100;
	this.id = 'monster';

	this.element = new createjs.Container();
	this.velocity = new Vec2d(0, 0);

	var image = new createjs.Bitmap('./img/monster.png');
	this.element.scaleX = this.element.scaleY = 0.15;

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
};

Monster.prototype.onHit = function(event) {
	if (event.hitTarget !== this.id) {
		return;
	}

	// push back girl
	var normalized_vector = this.velocity.norm();
	this.target.element.x += normalized_vector.x * 100;
	this.target.element.y += normalized_vector.y * 100;

	this.health -= event.damage;
	this.health = Math.max(0, this.health);
};

/**
 * @param event
 */
Monster.prototype.tick = function(event) {
	this.velocity.x = this.target.element.x - this.element.x;
	this.velocity.y = this.target.element.y - this.element.y;

	var delta = Vec2d.multiply(this.velocity, event.delta / 1000);
	var angle = Vec2d.getAngle(delta);

	this.element.x += delta.x;
	this.element.y += delta.y;

	this.element.rotation = angle;
};

module.exports = Monster;
