import * as THREE from "three";
import { MovementController } from "./movement_controller.ts";
import { InteractionController } from "./interaction_controller.ts";
import { ThreeToJolt } from "./threeToJolt.ts";

export type cameraType = "orthographic" | "perspective";

export class CameraController {
    private cam: THREE.OrthographicCamera | THREE.PerspectiveCamera;
    private movementController: MovementController;
    private interactionController: InteractionController;

    get Cam(): THREE.OrthographicCamera | THREE.PerspectiveCamera {
        return this.cam;
    }

    get MovementController(): MovementController {
        return this.movementController;
    }

    get InteractionController(): InteractionController {
        return this.interactionController;
    }

    constructor(
        renderer: THREE.WebGLRenderer,
        timeDelta: {current: number},
        threeToJolt: ThreeToJolt,
        sceneObjs: THREE.Object3D[],

        type: cameraType = "perspective", 
        fov: number = 75, 
        aspectRatio: number = window.innerWidth/window.innerHeight, 
        nearClip: number = 0.1, 
        farClip: number = 1000,
        
        verticalSens: number = 30,
        horizontalSens: number = 40,
        moveSpeed: number = 15
    ) {
        // create a new camera depending on the spec
        switch(type) {
            case "orthographic":
                this.cam = new THREE.OrthographicCamera(fov, aspectRatio, nearClip, farClip);
            case "perspective":
                this.cam = new THREE.PerspectiveCamera(fov, aspectRatio, nearClip, farClip);
        }

        // set up the movement controller; this sets up the basic movement of the camera including position updating and rotations
        this.movementController = new MovementController(
            this.cam, 
            renderer, 
            timeDelta,
            verticalSens,
            horizontalSens,
            moveSpeed
        );

        // set up the interaction controller; this sets up basic pick up interactions
        this.interactionController = new InteractionController(
            this.cam,
            threeToJolt,
            sceneObjs
        );
    }

    // inits the camera controller
    public init(): void {
        // init the movement controller
        this.movementController.init();
        // init the interaction controller
        this.interactionController.init();
    }

    // run this in the render loop
    public update(): void {
        // update the movement controller
        this.movementController.update();
        // update the interaction controller
        this.interactionController.update();
    }
}