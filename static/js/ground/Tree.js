'use strict';

var Tree = function(x, y, r) {
    this.element = new createjs.Container();

    var bitmap = new createjs.Bitmap("./img/tree.png");
    bitmap.x = x;
    bitmap.y = y;
    bitmap.scaleX = bitmap.scaleY = r / 100;
    this.element.addChild(bitmap);
};

module.exports = Tree;