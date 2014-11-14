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
	var self = this;

    this.velocity = new Vec2d(0, 0);

    this.element = new createjs.Container();

    var circle = new createjs.Shape();
    circle.graphics
        .beginFill("#000")
        .drawCircle(0, 0, 30);

	this.element.x = x;
	this.element.y = y;

    this.element.addChild(circle);

    stage.on("stagemousemove", function(evt) {
        self.velocity.x = evt.stageX - GameConsts.GAME_WIDTH / 2;
        self.velocity.y = evt.stageY - GameConsts.GAME_HEIGHT / 2;
    });
};

/**
 * @param event
 */
Player.prototype.tick = function(event) {
    var delta = Vec2d.multiply(this.velocity, event.delta / 1000);

    this.element.x += delta.x;
    this.element.y += delta.y;
};

module.exports = Player;
