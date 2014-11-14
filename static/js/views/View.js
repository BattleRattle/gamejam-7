'use strict';

var View = function() {
	this.element = new createjs.Container();
};

View.prototype.addChild = function(element) {
	this.element.addChild(element);
};

View.prototype.tick = function(event) {
	// @todo tick all child elements
};

module.exports = View;
