interface MarketType {
    class: string;
    slice: string;
}

export class Chessboard {
    public initialization: Promise<CallableFunction>;
    constructor(element: HTMLElement, props: object);
    addMarker(square: string, type: MarketType): void;
}
