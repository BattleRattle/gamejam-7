'use strict';

/**
 * @param {Stage} stage
 * @param {Number} x
 * @param {Number} y
 * @constructor
 */
var Player = function (stage, x, y) {
	var self = this;

    this.element = new createjs.Container();

    var circle = new createjs.Shape();
    circle.graphics
        .beginFill("#000")
        .drawCircle(0, 0, 30);

	this.element.x = x;
	this.element.y = y;

    this.element.addChild(circle);

    stage.on("stagemousemove", function(evt) {
        self.element.x = evt.stageX;
        self.element.y = evt.stageY;
    });
};

/**
 * @param event
 */
Player.prototype.tick = function(event) {
};

module.exports = Player;
