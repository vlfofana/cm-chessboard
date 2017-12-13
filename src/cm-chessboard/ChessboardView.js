/**
 * Author: shaack
 * Date: 21.11.2017
 */

import {Svg} from "../../node_modules/svjs-svg/src/svjs/Svg.js";
import {SQUARE_COORDINATES} from "./ChessboardModel.js";
import {ChessboardMoveInput} from "./ChessboardMoveInput.js";
import {INPUT_MODE} from "./Chessboard.js";

const SPRITE_LOADING_STATUS = {
    notLoaded: 1,
    loading: 2,
    loaded: 3
};

export class ChessboardView {

    constructor(containerElement, model, config, createCallback) {
        this.containerElement = containerElement;
        this.config = config;
        this.spriteLoadWaitingTries = 0;
        this.model = model;
        this.loadSprite(config, createCallback);
        this.spriteLoadWaitDelay = 0;
        this.moveInput = new ChessboardMoveInput(this, this.model, this.config, this.moveStartCallback, this.moveDoneCallback);
        if (config.responsive) {
            window.addEventListener('resize', () => {
                if (this.containerElement.offsetWidth !== this.width ||
                    this.containerElement.offsetHeight !== this.height) {
                    if (this.redrawTimer) {
                        window.clearTimeout(this.redrawTimer);
                    }
                    this.redrawTimer = setTimeout(() => {
                        this.createSvgAndMainGroup();
                        this.drawBoard();
                        this.drawFigures();
                        this.drawMarkers();
                    });
                }
            });
        }
        if (this.config.inputMode !== INPUT_MODE.viewOnly) {
            // Optimization: create and destroy event handlers on Chessboard.enableInput()
            containerElement.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                setTimeout(() => {
                    this.moveInput.onPointerDown(e);
                });
            });
            containerElement.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                setTimeout(() => {
                    this.moveInput.onPointerDown(e);
                });
            });
        }
        this.createSvgAndMainGroup();
    }

    // Sprite loader //

    loadSprite(config, callback) {
        if (ChessboardView.spriteLoadingStatus === SPRITE_LOADING_STATUS.notLoaded) {
            ChessboardView.spriteLoadingStatus = SPRITE_LOADING_STATUS.loading;
            Svg.loadSprite(config.sprite.file, [
                "wk", "wq", "wr", "wb", "wn", "wp",
                "bk", "bq", "br", "bb", "bn", "bp",
                "marker1", "marker2"], () => {
                ChessboardView.spriteLoadingStatus = SPRITE_LOADING_STATUS.loaded;
                callback();
            }, config.sprite.grid);
        } else if (ChessboardView.spriteLoadingStatus === SPRITE_LOADING_STATUS.loading) {
            setTimeout(() => {
                this.spriteLoadWaitingTries++;
                if (this.spriteLoadWaitingTries < 10) {
                    this.loadSprite(config, callback);
                } else {
                    console.error("timeout loading sprite", config.sprite.file);
                }
            }, this.spriteLoadWaitDelay);
            this.spriteLoadWaitDelay += 10;
        } else if (ChessboardView.spriteLoadingStatus === SPRITE_LOADING_STATUS.loaded) {
            callback();
        } else {
            console.error("error ChessboardView.spriteLoadingStatus", ChessboardView.spriteLoadingStatus);
        }

    }

    // Draw //

    createSvgAndMainGroup() {
        if (this.svg) {
            Svg.removeElement(this.svg);
        }
        this.svg = Svg.createSvg(this.containerElement);
        this.svg.setAttribute("class", "cm-chessboard");
        this.updateMetrics();
    }

    updateMetrics() {
        this.width = this.containerElement.offsetWidth;
        this.height = this.containerElement.offsetHeight;
        this.borderSize = this.width / 35;
        this.innerWidth = this.width - 2 * this.borderSize;
        this.innerHeight = this.height - 2 * this.borderSize;
        this.squareWidth = this.innerWidth / 8;
        this.squareHeight = this.innerHeight / 8;
        this.scalingX = this.squareWidth / this.config.sprite.grid;
        this.scalingY = this.squareHeight / this.config.sprite.grid;
        this.figureXTranslate = (this.squareWidth / 2 - this.config.sprite.grid * this.scalingY / 2); // for centering in square
    }

    setNeedsRedraw() {
        if (this.redrawTimer) {
            window.clearTimeout(this.redrawTimer);
        }
        this.redrawTimer = setTimeout(() => {
            this.drawBoard();
            if (this.config.showCoordinates) {
                this.drawCoordinates();
            }
            this.drawFigures();
            this.drawMarkers();
        });
    }

    // Board //

    drawBoard() {
        if (this.boardGroup) {
            Svg.removeElement(this.boardGroup);
        }
        this.boardGroup = Svg.addElement(this.svg, "g");
        this.boardGroup.setAttribute("class", "board");
        let boardBorder = Svg.addElement(this.boardGroup, "rect", {width: this.width, height: this.height});
        boardBorder.setAttribute("class", "board-border");
        for (let i = 0; i < 64; i++) {
            const squareColor = ((9 * i) & 8) === 0 ? 'black' : 'white';
            const fieldClass = "square " + squareColor;
            const point = this.squareIndexToPoint(i);
            const squareRect = Svg.addElement(this.boardGroup, "rect", {
                x: point.x, y: point.y, width: this.squareWidth, height: this.squareHeight
            });
            squareRect.setAttribute("class", fieldClass);
            // squareRect.setAttribute("data-square", SQUARE_COORDINATES[i]);
            if (this.model.orientation === "white") {
                squareRect.setAttribute("data-index", i);
            } else {
                squareRect.setAttribute("data-index", 63 - i);
            }
        }

        Svg.addElement(this.boardGroup, "line", {
            x1: this.borderSize, y1: this.borderSize,
            x2: this.width - this.borderSize, y2: this.borderSize, class: "surrounding-line"
        });
        Svg.addElement(this.boardGroup, "line", {
            x1: this.borderSize, y1: this.height - this.borderSize,
            x2: this.width - this.borderSize, y2: this.height - this.borderSize, class: "surrounding-line"
        });
        Svg.addElement(this.boardGroup, "line", {
            x1: this.borderSize, y1: this.borderSize,
            x2: this.borderSize, y2: this.height - this.borderSize, class: "surrounding-line"
        });
        Svg.addElement(this.boardGroup, "line", {
            x1: this.width - this.borderSize, y1: this.borderSize,
            x2: this.width - this.borderSize, y2: this.height - this.borderSize, class: "surrounding-line"
        });

        if (this.model.orientation === "black") {
            const transform = (this.svg.createSVGTransform());
            transform.setRotate(180, this.width / 2, this.height / 2);
            this.boardGroup.transform.baseVal.appendItem(transform);
        }
    }

    drawCoordinates() {
        if (this.coordinatesGroup) {
            Svg.removeElement(this.coordinatesGroup);
        }
        this.coordinatesGroup = Svg.addElement(this.svg, "g", {class: "coordinates"});
        // files
        for (let file = 0; file < 8; file++) {
            const textElement = Svg.addElement(this.coordinatesGroup, "text", {
                class: "coordinate file",
                x: this.borderSize + (18 + this.config.sprite.grid * file) * this.scalingX,
                y: this.height - (this.borderSize / 3.4),
                style: "font-size: " + this.scalingY * 7 + "px"
            });
            if (this.model.orientation === "white") {
                textElement.textContent = String.fromCharCode(97 + file);
            } else {
                textElement.textContent = String.fromCharCode(104 - file);
            }
        }

        // ranks
        for (let rank = 0; rank < 8; rank++) {
            const textElement = Svg.addElement(this.coordinatesGroup, "text", {
                class: "coordinate rank",
                x: (this.borderSize / 3.6),
                y: this.borderSize + 23 * this.scalingY + rank * this.squareHeight,
                style: "font-size: " + this.scalingY * 7 + "px"
            });
            if (this.model.orientation === "white") {
                textElement.textContent = 8 - rank;
            } else {
                textElement.textContent = 1 + rank;
            }
        }
    }

    // Figures //

    drawFigures() {
        if (this.figuresGroup) {
            Svg.removeElement(this.figuresGroup);
        }
        this.figuresGroup = Svg.addElement(this.svg, "g", {class: "figures"});
        for (let i = 0; i < 64; i++) {
            const figureName = this.model.squares[i];
            if (figureName) {
                this.drawFigure(i, figureName);
            }
        }
    }

    drawFigure(index, figureName) {
        const figureGroup = Svg.addElement(this.figuresGroup, "g");
        figureGroup.setAttribute("data-figure", figureName);
        figureGroup.setAttribute("data-index", index);
        const point = this.squareIndexToPoint(index);
        const transform = (this.svg.createSVGTransform());
        transform.setTranslate(point.x, point.y);
        figureGroup.transform.baseVal.appendItem(transform);
        const figureUse = Svg.addElement(figureGroup, "use", {"href": "#" + figureName, "class": "figure"});
        // center on square
        const transformTranslate = (this.svg.createSVGTransform());
        transformTranslate.setTranslate(this.figureXTranslate, 0);
        figureUse.transform.baseVal.appendItem(transformTranslate);
        // scale
        const transformScale = (this.svg.createSVGTransform());
        transformScale.setScale(this.scalingY, this.scalingY);
        figureUse.transform.baseVal.appendItem(transformScale);
        return figureGroup;
    }

    setFigureVisibility(index, visible = true) {
        const figure = this.getFigure(index);
        if (visible) {
            figure.setAttribute("visibility", "visible");
        } else {
            figure.setAttribute("visibility", "hidden");
        }

    }

    getFigure(index) {
        return this.figuresGroup.querySelector("g[data-index='" + index + "']");
    }

    // Markers //

    drawMarkers() {
        if (this.markersGroup) {
            Svg.removeElement(this.markersGroup);
        }
        this.markersGroup = Svg.addElement(this.svg, "g", {class: "markers"});
        this.model.markers.forEach((marker) => {
                this.drawMarker(marker);
            }
        );
    }

    drawMarker(marker) {
        const markerGroup = Svg.addElement(this.markersGroup, "g");
        markerGroup.setAttribute("data-index", marker.index);
        const point = this.squareIndexToPoint(marker.index);
        const transform = (this.svg.createSVGTransform());
        transform.setTranslate(point.x, point.y);
        markerGroup.transform.baseVal.appendItem(transform);
        const markerUse = Svg.addElement(markerGroup, "use",
            {"href": "#" + marker.type.slice, "class": "marker", opacity: marker.type.opacity});
        // scale
        const transformScale = (this.svg.createSVGTransform());
        transformScale.setScale(this.scalingX, this.scalingY);
        markerUse.transform.baseVal.appendItem(transformScale);
        return markerGroup;
    }

    // Helper //

    squareIndexToPoint(index) {
        let x, y;
        if (this.model.orientation === "white") {
            x = this.borderSize + (index % 8) * this.squareWidth;
            y = this.borderSize + (7 - Math.floor(index / 8)) * this.squareHeight;
        } else {
            x = this.borderSize + (7 - index % 8) * this.squareWidth;
            y = this.borderSize + (Math.floor(index / 8)) * this.squareHeight;
        }
        return {x: x, y: y};
    }

    // Callbacks //

    moveStartCallback(index) {
        if (this.config.events.inputStart) {
            return this.config.events.inputStart(SQUARE_COORDINATES[index]);
        } else {
            return true;
        }
    }

    moveDoneCallback(fromIndex, toIndex) {
        if (this.config.events.inputDone) {
            return this.config.events.inputDone(SQUARE_COORDINATES[fromIndex], SQUARE_COORDINATES[toIndex]);
        } else {
            return true;
        }
    }

}

ChessboardView.spriteLoadingStatus = SPRITE_LOADING_STATUS.notLoaded; // static