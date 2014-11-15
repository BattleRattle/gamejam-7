'use strict';

var GameConsts = require('../GameConsts');

var Tree = function(x, y, r) {
    var self = this;

    this.element = new createjs.Shape();

    //var img = new Image();
    //img.onload = function () {
    //    self.shape.graphics
    //        .beginBitmapFill(img, 'repeat')
    //        .drawRect(0, 0, 10000, 10000);
    //};
    //img.src = './img/grass.png';
    //var img = new Image();
    //img.onload = function() {
    //    self.shape.graphics
    //.beginBitmapFill(img, 'repeat')
    //.drawRect(0, 0, 10000, 10000);
    //};
    //img.src = './img/grass.png';

    this.element.graphics
        .beginFill("red")
        .drawCircle(x, y, r);

    //this.element.x = this.element.y = 50;
    //this.element.x = this.element.y = GameConsts.SIZE;
};

module.exports = Tree;