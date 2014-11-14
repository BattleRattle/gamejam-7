'use strict';

var GameConsts = require('../GameConsts');

var View = function() {
	this.element = new createjs.Container();
};

View.prototype.addChild = function(element) {
	this.element.addChild(element);
};

View.prototype.tick = function(event) {
	// @todo tick all child elements
	if (this.attachedTo) {
		this.element.setTransform(
			-this.attachedTo.x + GameConsts.GAME_WIDTH / 2,
			-this.attachedTo.y + GameConsts.GAME_HEIGHT / 2
		);
	}
};

View.prototype.attach = function(element) {
	this.attachedTo = element;
};

module.exports = View;
