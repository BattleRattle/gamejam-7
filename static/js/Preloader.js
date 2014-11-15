var EventEmitter = require('eventemitter2').EventEmitter2;

function Preloader() {
	this.queue = new createjs.LoadQueue();
	this.queue.installPlugin(createjs.Sound);
	this.queue.loadFile({id: 'swing1', src: "/sounds/swing1.mp3"});
}

Preloader.prototype.load = function(files) {
	this.queue.loadManifest(files);
};

Preloader.prototype.onComplete = function(callback) {
	this.queue.on('complete', callback);
};

module.exports = Preloader;