'use strict';

var Vec2d = require('./util/Vector2d'),
    GameConsts = require('./GameConsts');

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

    var image = new createjs.Bitmap('./img/player.png');
    this.element.scaleX = this.element.scaleY = 0.1;

    image.image.onload = function() {
        self.element.regX = self.element.getBounds().width / 2;
        self.element.regY = self.element.getBounds().height / 2;
    };

	this.element.x = x;
	this.element.y = y;

    this.element.addChild(image);

    stage.on("stagemousemove", function(evt) {
        self.velocity.x = evt.stageX - GameConsts.GAME_WIDTH / 2;
        self.velocity.y = evt.stageY - GameConsts.GAME_HEIGHT / 2;

        self.angle = Vec2d.getAngle(self.velocity);

        if (Math.abs(self.velocity.x) < 50) {
            self.velocity.x = 0;
        }
        if (Math.abs(self.velocity.y) < 50) {
            self.velocity.y = 0;
        }
    });
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
