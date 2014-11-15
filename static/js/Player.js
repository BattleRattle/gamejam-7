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
    var angle = Vec2d.getAngle(delta);

    this.element.x += delta.x;
    this.element.y += delta.y;

    this.element.rotation = angle;
};

module.exports = Player;
