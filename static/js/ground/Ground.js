'use strict';

var GameConsts = require('../GameConsts'),
	PseudoRand = require('../util/PseudoRand'),
	Tree = require('./Tree');

var Ground = function() {
	var self = this;

	this.pseudoRandom = new PseudoRand();
	this.pseudoRandom.setSeed(1);

	this.element = new createjs.Container();
	this.shape = new createjs.Shape();

	var img = new Image();
	img.onload = function() {
		self.shape.graphics
			.beginBitmapFill(img, 'repeat')
			.drawRect(0, 0, 10000, 10000);
	};
	img.src = './img/grass.png';

	this.element.addChild(this.shape);
	this.element.x = -GameConsts.SIZE;
	this.element.y = -GameConsts.SIZE;

	this.spawnTrees();
};

Ground.prototype.spawnTrees = function() {
	var x, y, r, i;

	for (i = 0; i <= 250; i++) {
		x = this.pseudoRandom.getRandom() % GameConsts.SIZE * 2;
		y = this.pseudoRandom.getRandom() % GameConsts.SIZE * 2;
		r = 70 + this.pseudoRandom.getRandom() % 100;

		this.element.addChild(new Tree(x, y, r).element);
	}
};

module.exports = Ground;
