var Monster = function(x, y) {
	this.radius = 30;
	this.maxHealth = this.health = 100;
	this.id = 'monster';

	this.element = new createjs.Container();

	var shape = new createjs.Shape();

	shape.graphics
		.beginFill("#F0F")
		.drawCircle(0, 0, 30);

	this.element.addChild(shape);

	this.element.x = x;
	this.element.y = y;
};

Monster.prototype.registerEvents = function(emitter) {
	emitter.on('hit', this.onHit.bind(this));
};

Monster.prototype.onHit = function(event) {
	if (event.hitTarget !== this.id) {
		return;
	}

	this.health -= event.damage;
	this.health = Math.max(0, this.health);
};

module.exports = Monster;
