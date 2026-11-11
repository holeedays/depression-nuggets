import { ThreeCanvas } from "./three_canvas.ts";

class App {
    private threeCanvas: ThreeCanvas;

    constructor() {
        this.threeCanvas = new ThreeCanvas();
    }

    // initializes the app
    public init(): void {
        // initialize the new three canvas
        this.threeCanvas.initUtils();
    }
}

// create an instance of our app
const app: App = new App();
// and run it
app.init();
