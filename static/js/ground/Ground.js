'use strict';

var GameConsts = require('../GameConsts'),
	PseudoRand = require('../util/PseudoRand'),
	Tree = require('./Tree'),
	Flower = require('./Flower');

var Ground = function() {
	this.pseudoRandom = new PseudoRand();

	this.element = new createjs.Container();
	this.element.mouseChildren = false;
	this.element.mouseEnabled = false;
	this.shape = new createjs.Shape();

	this.decorations = new createjs.Container();

	this.treeCount = 0;
	this.flowerCount = 0;

	var img = new Image();
	img.onload = function() {
		this.shape.graphics
			.beginBitmapFill(img, 'repeat')
			.drawRect(0, 0, GameConsts.SIZE * 2, GameConsts.SIZE * 2);
	}.bind(this);
	img.src = './img/grass.png';

	this.element.addChild(this.shape);
	this.element.addChild(this.decorations);
	this.element.x = -GameConsts.SIZE;
	this.element.y = -GameConsts.SIZE;
};

Ground.prototype.spawnFlowers = function() {
	var x, y, color, i;

	var colors = ['#f33', '#88f', '#f70', '#f0f', '#ddf'];

	for (i = 0; i <= this.flowerCount; i++) {
		x = this.pseudoRandom.getRandom() % GameConsts.SIZE * 2;
		y = this.pseudoRandom.getRandom() % GameConsts.SIZE * 2;
		color = colors[(Math.random() * colors.length | 0)];

		this.decorations.addChild(new Flower(x, y, color).element);
	}
};

Ground.prototype.spawnTrees = function() {
	var x, y, r, i;

	for (i = 0; i <= this.treeCount; i++) {
		x = this.pseudoRandom.getRandom() % GameConsts.SIZE * 2;
		y = this.pseudoRandom.getRandom() % GameConsts.SIZE * 2;
		r = 70 + this.pseudoRandom.getRandom() % 100;

		this.decorations.addChild(new Tree(x, y, r).element);
	}
};

Ground.prototype.registerEvents = function(emitter) {
	emitter.on('change-level', this.onChangeLevel.bind(this));
};

Ground.prototype.onChangeLevel = function(level) {
	this.pseudoRandom.setSeed(level.itemSeed);
	this.treeCount = level.trees;
	this.flowerCount = level.trees * 20;

	if (GameConsts.DRAW_FLOWERS) {
		this.spawnFlowers();
		this.spawnTrees();

		this.decorations.cache(0, 0, GameConsts.SIZE * 2, GameConsts.SIZE * 2);
		this.decorations.removeAllChildren();
	} else {
		this.spawnTrees();
	}
};

module.exports = Ground;
