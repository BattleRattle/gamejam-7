'use strict';

var Player = require('./Player'),
	Monster = require('./Monster'),
    EventEmitter = require('eventemitter2').EventEmitter2,
    FunBar = require('./hud/FunBar'),
    HealthBar = require('./hud/HealthBar'),
    ComboListener = require('./listener/ComboListener'),
    CollisionListener = require('./listener/CollisionListener'),
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

    var healthBar1 = new HealthBar(true, this.player);
    this.hudView.addChild(healthBar1);

    var healthBar2 = new HealthBar(false, monster);
    this.hudView.addChild(healthBar2);

    this.gameView.registerEvents(this.emitter);
    this.hudView.registerEvents(this.emitter);

    this.listeners = [];
    var comboListener = new ComboListener();
    comboListener.registerEvents(this.emitter);
    this.listeners.push(comboListener);
    var collisionListener = new CollisionListener(this.player, monster);
    collisionListener.registerEvents(this.emitter);
    this.listeners.push(collisionListener);

    createjs.Ticker.setFPS(30);
    createjs.Ticker.addEventListener('tick', function(event) {
        self.tick(event);
    });

    var emitter = this.emitter;
    setTimeout(function() {
        emitter.emit('hit', {
            timeStamp: new Date().getTime(),
            hitTarget: 'monster',
            damage: 10
        });
    }, 2000);

    setTimeout(function() {
        emitter.emit('hit', {
            timeStamp: new Date().getTime(),
            hitTarget: 'monster',
            damage: 10
        });
    }, 4000);
};

Game.prototype.tick = function(event) {
    this.player.tick(event);
	this.gameView.tick(event);
    this.hudView.tick(event);

    this.stage.update(event);
    for (var i = 0; i < this.listeners.length; i++) {
        if (typeof this.listeners[i]['tick'] == 'function') {
            this.listeners[i].tick(event);
        }
    }
};

module.exports = Game;
