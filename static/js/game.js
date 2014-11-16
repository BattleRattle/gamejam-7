var EventEmitter = require('eventemitter2').EventEmitter2,
    GameScreen = require('./screens/GameScreen'),
    MarioIsInAnotherCastleScreen = require('./screens/MarioIsInAnotherCastleScreen'),
    HomeScreen = require('./screens/HomeScreen'),
    StoryScreen = require('./screens/StoryScreen'),
    GameOverScreen = require('./screens/GameOverScreen'),
    story = require('./level/story');

'use strict';

var Game = function(gameCanvasId) {
    var self = this;

    this.level = 0;

    this.emitter = new EventEmitter();
    this.stage = new createjs.Stage(gameCanvasId);

    this.stage.mouseChildren = false;
    this.stage.mouseEnabled = false;

    this.gameScreen = new GameScreen(this.stage);
    this.gameOverScreen = new GameOverScreen();
    this.marioIsInAnotherCastleScreen = new MarioIsInAnotherCastleScreen();
    this.homeScreen = new HomeScreen();
    this.storyScreen = new StoryScreen();
    this.stage.addChild(this.gameScreen.element);
    this.stage.addChild(this.gameOverScreen.element);
    this.stage.addChild(this.marioIsInAnotherCastleScreen.element);
    this.stage.addChild(this.homeScreen.element);
    this.stage.addChild(this.storyScreen.element);

    this.gameScreen.registerEvent(this.emitter);
    this.registerEvents(this.emitter);

    createjs.Ticker.setFPS(60);
    createjs.Ticker.setPaused(true);
    createjs.Ticker.addEventListener('tick', function(event) {
        self.tick(event);
    });
};

Game.prototype.registerEvents = function(emitter) {
    emitter.on('player-dead', this.onGameOver.bind(this));
    emitter.on('monster-dead', this.onNextCastleScreen.bind(this));

    this.stage.on('stagemousemove', function(event) {
        emitter.emit('stagemousemove', event);
    });
};

Game.prototype.init = function() {
    this.homeScreen.start();
};

Game.prototype.assetsReady = function() {
    this.homeScreen.isReady();
    this.stage.on('stagemouseup', function() {
        this.homeScreen.reset();
        this.startNewgame();
    }.bind(this));
};

Game.prototype.startNewgame = function() {
    this.doStart(true);
};

Game.prototype.doStart = function(newGame) {
    var texts = story[0];
    this.storyScreen.start(texts.girl, texts.monster);
    this.stage.on('stagemouseup', function() {
        this.storyScreen.reset();
        this.start(newGame);

        this.emitter.emit('start-level', true);
    }.bind(this));
};

Game.prototype.start = function() {
    this.changeScreen();
    this.level++;

    this.gameScreen.start();

    createjs.Ticker.setPaused(false);
};

Game.prototype.onNextCastleScreen = function(event) {
    createjs.Ticker.setPaused(true);
    this.gameScreen.reset();
    this.changeScreen();

    this.marioIsInAnotherCastleScreen.start();
    this.stage.on('stagemouseup', function() {
        this.marioIsInAnotherCastleScreen.reset();
        this.doStart(false);
    }.bind(this));
};

Game.prototype.onGameOver = function(event) {
    createjs.Ticker.setPaused(true);
    this.gameScreen.reset();
    this.changeScreen();

    this.gameOverScreen.start();
    this.stage.on('stagemouseup', function() {
        this.gameOverScreen.reset();
        this.level = 0;
        this.start();
        this.emitter.emit('game-over');

    }.bind(this));
};

Game.prototype.changeScreen = function() {
    this.emitter.removeAllListeners();
    this.stage.removeAllEventListeners();
    this.registerEvents(this.emitter);
};

Game.prototype.tick = function(event) {
    this.stage.update(event);

	if (event.paused) {
		return;
	}

    this.gameScreen.tick(event);
};

module.exports = Game;
