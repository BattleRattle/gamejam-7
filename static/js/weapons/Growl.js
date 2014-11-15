var Vec2d = require('../util/Vector2d'),
    GameConsts = require('../GameConsts');

function Growl(x, y, target, lifetime, relativeLifetime) {
    this.id = 'growl';

    this.element = new createjs.Container();

	var fireball = new createjs.Bitmap("./img/fireball.png");
	this.element.scaleX = this.element.scaleY = 0.3;

    fireball.image.onload = function() {
		this.element.regX = this.element.getBounds().width / 2;
		this.element.regY = this.element.getBounds().height / 2;
	}.bind(this);

	this.element.addChild(fireball);

	this.target = target;
    this.element.x = x;
    this.element.y = y;
    this.lifetime = lifetime;
    this.velocity = new Vec2d(0, 0);

	createjs.Tween.get(this.element)
		.to({rotation: relativeLifetime}, relativeLifetime)
		.call(function() {
			this.element.removeChild(fireball);
		}.bind(this));
}

Growl.prototype.hit = function() {
    this.lifetime = 0;
};

Growl.prototype.isShortAttacking = function() {
    return true;
};

Growl.prototype.getRadius = function() {
    return 20;
};

Growl.prototype.tick = function(event) {
    var current = new Vec2d(this.target.element.x, this.target.element.y);
    var target  = new Vec2d(this.element.x, this.element.y);

    var vector_to_destination = Vec2d.subtract(current, target);
    var distance = vector_to_destination.length();

    // calculate new velocity according to current velocity and position of target
    vector_to_destination.norm().times(0.5);
    this.velocity.norm().times(20);
    this.velocity = this.velocity.plus(vector_to_destination);

    // set speed of monster according to distance to target
    this.velocity.times(distance);

    var delta = Vec2d.multiply(this.velocity, event.delta / 8000);

    this.element.x += delta.x;
    this.element.y += delta.y;
};

module.exports = Growl;
