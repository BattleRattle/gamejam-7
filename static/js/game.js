'use strict';

var Player = require('./Player'),
	Monster = require('./Monster'),
    EventEmitter = require('eventemitter2').EventEmitter2,
    FunBar = require('./hud/FunBar'),
	View = require('./views/View');

var Game = function(gameCanvasId) {
    var self = this;

    this.emitter = new EventEmitter();
    this.stage = new createjs.Stage(gameCanvasId);

	this.gameView = new View();
	this.stage.addChild(this.gameView.element);

	this.hudView = new View();
	this.stage.addChild(this.hudView.element);

    var funBar = new FunBar();
    this.hudView.addChild(funBar);

    this.player = new Player(this.stage, 200, 200);
	this.gameView.addChild(this.player);
	this.gameView.attach(this.player);

	var monster = new Monster(700, 300);
	this.gameView.addChild(monster);

    this.gameView.registerEvents(this.emitter);
    this.hudView.registerEvents(this.emitter);

    createjs.Ticker.setFPS(30);
    createjs.Ticker.addEventListener('tick', function(event) {
        self.tick(event);
    });
};

Game.prototype.tick = function(event) {
    this.player.tick(event);
	this.gameView.tick(event);
    this.hudView.tick(event);

    this.stage.update(event);
};

module.exports = Game;
