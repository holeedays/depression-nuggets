import * as THREE from "three";
import { MKMovementController } from "./mk_movement_controller.ts";
import { MKInteractionController } from "./mk_interaction_controller.ts";
import { ThreeToJolt } from "./threeToJolt.ts";

import { type CameraType, createCamera } from "./camera.ts";

export class MKController {
    private cam: THREE.OrthographicCamera | THREE.PerspectiveCamera;
    private movementController: MKMovementController;
    private interactionController: MKInteractionController;

    get Cam(): THREE.OrthographicCamera | THREE.PerspectiveCamera {
        return this.cam;
    }

    get MovementController(): MKMovementController {
        return this.movementController;
    }

    get InteractionController(): MKInteractionController {
        return this.interactionController;
    }

    constructor(
        renderer: THREE.WebGLRenderer,
        timeDelta: {current: number},
        threeToJolt: ThreeToJolt,
        interactableObjs: THREE.Object3D[],

        cameraSettings: {
            camType: CameraType,
            fov: number,
            aspectRatio: number,
            nearClip: number,
            farClip: number
        } = {
            camType: "perspective", 
            fov: 75, 
            aspectRatio: window.innerWidth/window.innerHeight, 
            nearClip: 0.1, 
            farClip: 1000,
        },
        movementSettings: {
            verticalSens: number,
            horizontalSens: number,
            moveSpeed: number,
            sprintSpeed: number
        } = {
            verticalSens: 30,
            horizontalSens: 40,
            moveSpeed: 15,
            sprintSpeed: 50
        },
        interactionSettings: {
            raycastNear: number,
            raycastFar: number,
            crosshairSize: THREE.Vector3,
            crosshairDist: number
        } = {
            raycastNear: 0,
            raycastFar: Number.POSITIVE_INFINITY,
            crosshairSize: new THREE.Vector3(0.02, 0.02, 0.02),
            crosshairDist: 1
        }
    ) {
        // destructure properties from the settings
        const {camType, fov, aspectRatio, nearClip, farClip} = cameraSettings;
        const {verticalSens, horizontalSens, moveSpeed, sprintSpeed} = movementSettings;
        const {raycastNear, raycastFar, crosshairSize, crosshairDist} = interactionSettings;

        // create a new camera
        this.cam = createCamera(camType, fov, aspectRatio, nearClip, farClip);

        // set up the movement controller; this sets up the basic movement of the camera including position updating and rotations
        this.movementController = new MKMovementController(
            renderer, 
            this.cam, 
            timeDelta,
            verticalSens,
            horizontalSens,
            moveSpeed,
            sprintSpeed 
        );

        // set up the interaction controller; this sets up basic pick up interactions
        this.interactionController = new MKInteractionController(
            this.cam,
            threeToJolt,
            interactableObjs,
            raycastNear,
            raycastFar,
            crosshairSize,
            crosshairDist
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