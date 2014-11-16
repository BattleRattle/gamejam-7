'use strict';

var Vec2d = require('./util/Vector2d'),
    GameConsts = require('./GameConsts');

var funFactor = 3;

/**
 * @param {Number} x
 * @param {Number} y
 * @constructor
 */
var Player = function (x, y) {
    var self = this;

    this.radius = 30;
    this.maxHealth = this.health = 100;
    this.id = 'player';
    this.angle = 0;
	this.footstepsPlayed = 0;
	this.footstepNumber = 1;

	this.attackStarted = 0;
    this.velocity = new Vec2d(0, 0);
    this.bounceVelocity = new Vec2d(0, 0);

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

    this.hasFun = false;

    this.element.addChild(this.sprite);
};

Player.prototype.registerEvents = function(emitter) {
    emitter.on('hit', this.onHit.bind(this));
    emitter.on('attack', this.onAttack.bind(this));
    emitter.on('stagemousemove', this.onMouseMove.bind(this));
    emitter.on('fun', this.onFun.bind(this));
    emitter.on('change-level', this.onChangeLevel.bind(this));
    emitter.on('heal-me', this.onHealMe.bind(this));
    emitter.on('player-weapon-lifetime', this.onPlayerWeaponLifetime.bind(this));

	this.emitter = emitter;
};

Player.prototype.onHit = function(event) {
    if (event.hitTarget !== this.id) {
        return;
    }

    if (this.hasFun) {
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

    if (this.hasFun) {
        mouse_delta.times(funFactor);
        this.emitter.emit('has-fun', {x: this.element.x, y: this.element.y});
    }

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

Player.prototype.onFun = function(event) {
    this.hasFun = event.status;
};

Player.prototype.onHealMe = function(event) {
    this.health = this.maxHealth;
};

Player.prototype.onPlayerWeaponLifetime = function(event) {
    if (!this.weapon) {
        return;
    }

    this.weapon.lifetime = 1000000;
    this.weapon.triggerUpdate();
};

/**
 * @param event
 */
Player.prototype.tick = function(event) {
    var delta = Vec2d.multiply(this.velocity, event.delta / 1000);

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

    this.element.x = Math.min(GameConsts.SIZE, Math.max(-GameConsts.SIZE, this.element.x));
    this.element.y = Math.min(GameConsts.SIZE, Math.max(-GameConsts.SIZE, this.element.y));

    this.element.rotation = this.angle;

	// change speed of animation
    this.sprite.framerate = delta.length() * 6;

    if (this.weapon) {
        if (!this.weapon.equipped) {
            this.element.removeChild(this.weapon.element);
            this.weapon = null;
            this.emitter.emit('unequip');
        } else {
            var attackStartedDiff = event.timeStamp - this.attackStarted;
            if (attackStartedDiff < 500) {
                this.element.rotation = Math.round(this.element.rotation + 1080 / 500 * attackStartedDiff);
            }

            this.weapon.tick(event);
        }
    }

	if (this.velocity.length() > 0 && (event.timeStamp - this.footstepsPlayed) > 45000 / this.velocity.length()) {
		createjs.Sound.play('footstep' + this.footstepNumber, {volume: 0.6});
		this.footstepsPlayed = event.timeStamp;
		this.footstepNumber = (this.footstepNumber + 1) % 2;
	}
};

Player.prototype.equip = function(weapon) {
    weapon.equip();
    this.weapon = weapon;
    this.weapon.registerEvents(this.emitter);
    this.element.addChild(weapon.element);
    this.emitter.emit('equip', {
        id: this.weapon.id,
        lifetime: this.weapon.lifetime
    })
};

Player.prototype.getRadius = function () {
    if (this.isShortAttacking()) {
        if (this.weapon) {
            return this.weapon.radius;
        }

        return this.radius;
    }

    return this.radius;
};

Player.prototype.isShortAttacking = function() {
    if (this.hasFun) {
        return true;
    }

    if (this.weapon && this.weapon.id == 'short-weapon' && this.weapon.isActive) {
        return true;
    }

    return false;
};

Player.prototype.onChangeLevel = function(level) {
    this.maxHealth = level.playerHealth;
    this.health = level.playerHealth;
};

module.exports = Player;
