function RainbowRoad() {
    this.element = new createjs.Container();
}

RainbowRoad.prototype.paint = function(event) {
    /*var shape = new createjs.Shape();
    shape.graphics
        .beginFill("#F0F")
        .drawCircle(event.x, event.y, 20);

    this.element.addChild(shape);*/
};

RainbowRoad.prototype.tick = function(event) {
    // remove old paintings
};

module.exports = RainbowRoad;
