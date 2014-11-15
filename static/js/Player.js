'use strict';

var Vec2d = require('./util/Vector2d'),
    GameConsts = require('./GameConsts');

/**
 * @param {Number} x
 * @param {Number} y
 * @constructor
 */
var Player = function (x, y) {
    this.radius = 30;
    this.maxHealth = this.health = 100;
    this.id = 'player';
    this.angle = 0;
	this.footstepsPlayed = 0;
	this.footstepNumber = 1;

	var self = this;

	this.attackStarted = 0;
    this.velocity = new Vec2d(0, 0);
    this.bounceVelocity = null;

    this.element = new createjs.Container();

	var ss = new createjs.SpriteSheet({
		"animations":
		{
			"walk": {
				frames: [1, 2],
				next:"walk",
				speed: 0.2
			},
			"wait": {
				frames: [0],
				next:"wait",
				speed: 0.2
			}
		},
		"images": ["./img/player_sprite.png"],
		"frames":
		{
			"height": 1024,
			"width":1024,
			"regX": 0,
			"regY": 0,
			"count": 3
		}
	});

	this.sprite = new createjs.Sprite(ss, "wait");

    this.element.scaleX = this.element.scaleY = 0.1;
	self.element.regX = self.element.regY = 512;

	this.element.x = x;
	this.element.y = y;

    this.element.addChild(this.sprite);
};

Player.prototype.registerEvents = function(emitter) {
    emitter.on('hit', this.onHit.bind(this));
    emitter.on('attack', this.onAttack.bind(this));
    emitter.on('stagemousemove', this.onMouseMove.bind(this));

	this.emitter = emitter;
};

Player.prototype.onHit = function(event) {
    if (event.hitTarget !== this.id) {
        return;
    }

    this.health -= event.damage;
    this.health = Math.max(0, this.health);

	if (this.health == 0) {
		this.emitter.emit('player-dead');
	}
};

Player.prototype.onAttack = function(event) {
	this.attackStarted = new Date().getTime();
};


Player.prototype.onMouseMove = function(event) {
    var current_speed = this.velocity.length();

    var mouse_delta = new Vec2d(
        event.stageX - GameConsts.GAME_WIDTH / 2,
        event.stageY - GameConsts.GAME_HEIGHT / 2
    );

    this.angle = Vec2d.getAngle(mouse_delta);

    if (mouse_delta.length() < 60) {
        this.velocity.x = 0;
        this.velocity.y = 0;

        if (current_speed) {
            this.sprite.gotoAndPlay('wait');
        }

        return;
    } else if(current_speed == 0) {
        this.sprite.gotoAndPlay('walk');
    }

    this.velocity = mouse_delta;
};

/**
 * @param event
 */
Player.prototype.tick = function(event) {
    var delta = Vec2d.multiply(this.velocity, event.delta / 1000);

    if (this.bounceVelocity) {
        var push_delta = Vec2d.multiply(this.bounceVelocity.clone(), event.delta / 80);
        this.bounceVelocity = this.bounceVelocity.minus(push_delta);

        delta.plus(push_delta);

        if (push_delta.length() < 1) {
            this.bounceVelocity = null;
        }
    }

    this.element.x += delta.x;
    this.element.y += delta.y;

    this.element.x = Math.min(GameConsts.SIZE, Math.max(-GameConsts.SIZE, this.element.x));
    this.element.y = Math.min(GameConsts.SIZE, Math.max(-GameConsts.SIZE, this.element.y));

    this.element.rotation = this.angle;

	var attackStartedDiff = event.timeStamp - this.attackStarted;
	if (attackStartedDiff < 500) {
		this.element.rotation = Math.round(this.element.rotation + 1080 / 500 * attackStartedDiff);
	}

    // change speed of animation
    this.sprite.framerate = delta.length() * 6;

    if (this.weapon) {
        this.weapon.tick(event);
    }

	if (this.velocity.length() > 0 && (event.timeStamp - this.footstepsPlayed) > 45000 / this.velocity.length()) {
		createjs.Sound.play('footstep' + this.footstepNumber, {volume: 0.6});
		this.footstepsPlayed = event.timeStamp;
		this.footstepNumber = (this.footstepNumber + 1) % 2;
	}
};

Player.prototype.equip = function(weapon) {
    this.weapon = weapon;
    this.element.addChild(weapon.element);
};

Player.prototype.getRadius = function () {
    if (this.isShortAttacking()) {
        return this.weapon.radius;
    }

    return this.radius;
};

Player.prototype.isShortAttacking = function() {
    if (this.weapon && this.weapon.id == 'short-weapon' && this.weapon.isActive) {
        return true;
    }

    return false;
};

module.exports = Player;
