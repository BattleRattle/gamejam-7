'use strict';

var Game = function(gameCanvasId) {
    var self = this;

    this.stage = new createjs.Stage(gameCanvasId);

    createjs.Ticker.setFPS(30);
    createjs.Ticker.addEventListener('tick', function(event) {
        self.tick(event);
    });


};

Game.prototype.tick = function(event) {
    this.stage.update(event);
};

module.exports = Game;