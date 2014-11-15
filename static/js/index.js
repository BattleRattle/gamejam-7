'use strict';

var Game = require('./game'),
	Preloader = require('./Preloader'),
	assets = require('./assets');

var preloader = new Preloader();
var game = new Game('game_canvas');
game.init();

preloader.onComplete(function() {
	game.assetsReady();
});

preloader.load(assets);
