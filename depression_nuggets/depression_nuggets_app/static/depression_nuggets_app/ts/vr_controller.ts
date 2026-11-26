import * as THREE from "three";
import { VRInteractionController } from "./vr_interaction_controller.ts";
import { VRMovementController } from "./vr_movement_controller.ts";
import { ThreeToJolt } from "./threeToJolt.ts";

import { 
    VRButton, 
    XRControllerModelFactory,
    OculusHandModel,
    OculusHandPointerModel
} from "three/addons/Addons.js";

import { type CameraType, createCamera } from "./camera.ts";

export class VRController {
    private renderer: THREE.WebGLRenderer;

    private interactionController: VRInteractionController;
    private movementController: VRMovementController;
    private controllers: { 
        left: THREE.XRTargetRaySpace, 
        right: THREE.XRTargetRaySpace,
        leftGrip: THREE.XRGripSpace,
        rightGrip: THREE.XRGripSpace
    } | null = null;
    private cam: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    private dolly: THREE.Group;

    get Cam(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
        return this.cam;
    }

    get Dolly(): THREE.Group {
        return this.dolly;
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
            maxHorizontalSens: number,
            horizontalSensAccelerationRate: number,
            horizontalSensAccelerationThreshold: number,
            moveSpeed: number,
            maxMoveSpeed: number,
            moveSpeedAccelerationRate: number,
            moveSpeedAccelerationThreshold: number,
            sprintSpeed: number
        } = {
            verticalSens: 30,
            horizontalSens: 40,
            maxHorizontalSens: 100,
            horizontalSensAccelerationRate: 1.01,
            horizontalSensAccelerationThreshold: 0.8,

            moveSpeed: 15,
            maxMoveSpeed: 20,
            moveSpeedAccelerationRate: 1.001,
            moveSpeedAccelerationThreshold: 0.8,
            sprintSpeed: 50
        }
    ) {
        // init the references
        this.renderer = renderer;

        // destructure the settings objs
        const {camType, fov, aspectRatio, nearClip, farClip} = cameraSettings;
        const {
            verticalSens, 
            horizontalSens, 
            maxHorizontalSens, 
            horizontalSensAccelerationRate,
            horizontalSensAccelerationThreshold,
            moveSpeed, 
            maxMoveSpeed,
            moveSpeedAccelerationRate,
            moveSpeedAccelerationThreshold,
            sprintSpeed
        } = movementSettings;

        // create the camera
        this.cam = createCamera(camType, fov, aspectRatio, nearClip, farClip);

        // create the dolly
        this.dolly = new THREE.Group();

        // init the VR interaction controller
        this.interactionController = new VRInteractionController(
            threeToJolt,
            interactableObjs
        );
        // init the movement controller
        this.movementController = new VRMovementController(
            renderer,
            this.dolly, 
            timeDelta,

            verticalSens,
            horizontalSens,
            maxHorizontalSens,
            horizontalSensAccelerationRate,
            horizontalSensAccelerationThreshold,

            moveSpeed,
            maxMoveSpeed,
            moveSpeedAccelerationRate,
            moveSpeedAccelerationThreshold,
            sprintSpeed
        );
    }

    // inits the VR controller
    public init(VRButtonCallbackFn: (ev: MouseEvent) => void): void {
        // init the VR base first
        this.initVRBase(VRButtonCallbackFn);
        // init the controllers
        this.initControllers();
        // init the interaction controller
        this.interactionController.init();
        // init the dolly
        this.initDolly();
    }

    // inits the base features to allow VR to occur 
    private initVRBase(VRButtonCallbackFn: (ev: MouseEvent) => void): void {
        // set up renderer
        this.renderer.xr.enabled = true;
        // this increases resolution on the quest
        this.renderer.xr.setFramebufferScaleFactor(2.0);
        // create a VR button
        const VRHTMLButton: HTMLElement = VRButton.createButton(this.renderer);
        // add a callback when the button is click (this is for updating states in the code)
        VRHTMLButton.addEventListener("click", VRButtonCallbackFn);
        // add the button to the body
        document.body.append(VRHTMLButton);
    }

    // sets up the controllers and puts them into the scene + sets variables/fields relating to the controllers
    private initControllers(): void {
        // get the XR manager from the renderer
        const XRManager: THREE.WebXRManager = this.renderer.xr;

        // set up controllers

        // left controller
        const leftController: THREE.XRTargetRaySpace = XRManager.getController(0);
        leftController.name = "left";

        // right controller
        const rightController: THREE.XRTargetRaySpace = XRManager.getController(1);
        rightController.name = "right";

        // set up controller grips
        const controllerModelFactory: XRControllerModelFactory = new XRControllerModelFactory();

        // left grip
        const leftControllerGrip: THREE.XRGripSpace = XRManager.getControllerGrip(0);
        leftControllerGrip.add(
            controllerModelFactory.createControllerModel(leftControllerGrip)
        );

        // right grip
        const rightControllerGrip: THREE.XRGripSpace = XRManager.getControllerGrip(1);
        rightControllerGrip.add(
            controllerModelFactory.createControllerModel(rightControllerGrip)
        );

        // set references to these controllers + grips in our global controllers field
        this.controllers = {
            left: leftController, 
            right: rightController, 
            leftGrip: leftControllerGrip, 
            rightGrip: rightControllerGrip
        };
        // pass the controllers reference to the interaction controller
        this.interactionController.Controllers = this.controllers;
    }

    // inits the base transforms for the dolly
    private initDolly(): void {
        if (this.controllers === null) {
            console.warn("VR controllers haven't been initialized");
            return;
        }

        // set the position and other misc features for the dolly
        this.dolly.name = "dolly";
        this.dolly.add(this.cam);

        // child the controllers to the dolly
        this.dolly.add(
            this.controllers.left,
            this.controllers.right,
            this.controllers.leftGrip,
            this.controllers.rightGrip
        );
    }

    // pass this into the render update loop
    public update(): void {
        // update the interaction controller
        this.interactionController.update();
        // update the movement controller
        this.movementController.update();
    }
}
