'use strict';

var Player = require('./Player'),
	Monster = require('./Monster'),
	View = require('./views/View');

var Game = function(gameCanvasId) {
    var self = this;

    this.stage = new createjs.Stage(gameCanvasId);

	this.gameView = new View();
	this.stage.addChild(this.gameView.element);


	this.hudView = new View();
	this.stage.addChild(this.hudView.element);

    var player = new Player(this.stage, 200, 200);
	this.gameView.addChild(player);
	this.gameView.attach(player);

	var monster = new Monster(700, 300);
	this.gameView.addChild(monster);

    createjs.Ticker.setFPS(30);
    createjs.Ticker.addEventListener('tick', function(event) {
        self.tick(event);
    });
};

Game.prototype.tick = function(event) {
	this.gameView.tick(event);
    this.stage.update(event);
};

module.exports = Game;
