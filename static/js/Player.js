'use strict';

var Vec2d = require('./util/Vector2d'),
    GameConsts = require('./GameConsts'),
	GameOverScreen = require('./screens/GameOverScreen');

/**
 * @param {Stage} stage
 * @param {Number} x
 * @param {Number} y
 * @constructor
 */
var Player = function (stage, x, y) {
    this.radius = 30;
    this.maxHealth = this.health = 100;
    this.id = 'player';
    this.angle = 0;

	var self = this;

    this.velocity = new Vec2d(0, 0);

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

	this.sprite = new createjs.Sprite(ss, "walk");


    this.element.scaleX = this.element.scaleY = 0.1;
	self.element.regX = self.element.regY = 512;

	this.element.x = x;
	this.element.y = y;

    this.element.addChild(this.sprite);

    stage.on("stagemousemove", function(evt) {
		var length = self.velocity.length();

		self.velocity.x = evt.stageX - GameConsts.GAME_WIDTH / 2;
        self.velocity.y = evt.stageY - GameConsts.GAME_HEIGHT / 2;

        self.angle = Vec2d.getAngle(self.velocity);

        if ((Math.abs(self.velocity.x) < 50 || Math.abs(self.velocity.y) < 50) && self.velocity.length()) {
            self.velocity.x = 0;
            self.velocity.y = 0;

			self.sprite.gotoAndPlay('wait');
        } else if(length == 0 && (Math.abs(self.velocity.x) > 50 || Math.abs(self.velocity.y) > 50)) {
			self.sprite.gotoAndPlay('walk');
		}
    });

	this.stage = stage;
};

Player.prototype.registerEvents = function(emitter) {
    emitter.on('hit', this.onHit.bind(this));
};

Player.prototype.onHit = function(event) {
    if (event.hitTarget !== this.id) {
        return;
    }

    this.health -= event.damage;
    this.health = Math.max(0, this.health);

	if (this.health == 0) {
		var gameOverScreen = new GameOverScreen();
		this.stage.addChild(gameOverScreen.element);
	}
};

/**
 * @param event
 */
Player.prototype.tick = function(event) {
    var delta = Vec2d.multiply(this.velocity, event.delta / 1000);

    this.element.x += delta.x;
    this.element.y += delta.y;

    this.element.x = Math.min(GameConsts.SIZE, Math.max(-GameConsts.SIZE, this.element.x));
    this.element.y = Math.min(GameConsts.SIZE, Math.max(-GameConsts.SIZE, this.element.y));

    this.element.rotation = this.angle;

    if (this.weapon) {
        this.weapon.tick(event);
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
