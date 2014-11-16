var Vec2d = require('../util/Vector2d'),
    GameConsts = require('../GameConsts');

function Growl(x, y, target, lifetime, relativeLifetime) {
    this.id = 'growl';

    this.element = new createjs.Container();

    this.fireball = new createjs.Container();
	var fireball = new createjs.Bitmap("./img/fireball.png");

	this.fireball.scaleX = this.fireball.scaleY = 0.3;

    fireball.image.onload = function() {
		this.fireball.regX = this.fireball.getBounds().width / 2;
		this.fireball.regY = this.fireball.getBounds().height / 2;
	}.bind(this);

	this.fireball.addChild(fireball);
    this.element.addChild(this.fireball);

	this.target = target;
    this.element.x = x;
    this.element.y = y;
    this.lifetime = lifetime;
    this.velocity = new Vec2d(0, 0);

	createjs.Tween.get(this.fireball)
		.to({rotation: relativeLifetime}, relativeLifetime - 500)
		.call(function() {
			this.element.removeChild(this.fireball);
		}.bind(this));

    var data = new createjs.SpriteSheet({
        "images": ['./img/poof.png'],
        "frames": {
            "regX": 0,
            "height": 128,
            "count": 64,
            "regY": 0,
            "width": 128
        },
        "animations": {"empty": [0], "default": [1, 64, "empty"]}
    });

    createjs.Tween.get(this.element)
        .wait(relativeLifetime - 1000)
        .call(function() {
            var animation = new createjs.Sprite(data, "default");
            animation.x = -64;
            animation.y = -64;
            animation.framerate = 60;
            this.element.addChild(animation);
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
    vector_to_destination.norm().times(0.7);
    this.velocity.norm().times(20);
    this.velocity = this.velocity.plus(vector_to_destination);

    // set speed of monster according to distance to target
    this.velocity.times(100 + distance / 2.5);

    var delta = Vec2d.multiply(this.velocity, event.delta / 8000);

    this.element.x += delta.x;
    this.element.y += delta.y;
};

module.exports = Growl;
