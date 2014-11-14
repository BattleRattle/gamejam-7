'use strict';

var Player = require('./Player');

var Game = function(gameCanvasId) {
    var self = this;

    this.stage = new createjs.Stage(gameCanvasId);

    var player = new Player(100, 100);
    this.stage.addChild(player.element);

    createjs.Ticker.setFPS(30);
    createjs.Ticker.addEventListener('tick', function(event) {
        self.tick(event);
    });


};

Game.prototype.tick = function(event) {
    this.stage.update(event);
};

module.exports = Game;