import * as THREE from "three";

import { MKController } from "./mk_controller.ts";
import { VRController } from "./vr_controller.js";
import { ThreeToJolt } from "./threeToJolt.ts";
import { Jolt, LAYER } from "./physics.ts";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class ThreeCanvas {
    private scene: THREE.Scene;
    private renderer: THREE.WebGLRenderer;
    private time: THREE.Timer;
    private timeDelta: {current: number} = {current: 0};

    private targetCam: THREE.PerspectiveCamera | THREE.OrthographicCamera | null = null;

    private threeToJolt: ThreeToJolt;
    private MK: MKController;
    private VR: VRController;
    private interactableObjs: THREE.Object3D[] = [];

    private VRIsEnabled: boolean = false;

    constructor (
        rendererOverloads: {
            width: number, height: number
        } = {width: window.innerWidth, height: window.innerHeight}
    ) {
        // create a scene obj
        this.scene = new THREE.Scene();
        // set up a <canvas> element, this will render the 3D scene
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(rendererOverloads.width, rendererOverloads.height);
        // add it to our DOM
        document.body.appendChild(this.renderer.domElement);
        // also set up a timer so we can get delta time
        this.time = new THREE.Timer();
        // connect it to the native page visibility API to avoid overflows when the page is not closed
        this.time.connect(document);

        // create a three to jolt obj (connects jolt physics bodies with three js meshes)
        this.threeToJolt = new ThreeToJolt(this.timeDelta);
        // create a MK controller, pass the renderer, timeDelta, threeToJolt, and interactable objs array
        this.MK = new MKController(
            this.renderer, 
            this.timeDelta, 
            this.threeToJolt, 
            this.interactableObjs
        );
        // create a VR controller as well, pass the renderer, timeDelta, threeToJolt, and interactable objs array
        this.VR = new VRController(
            this.renderer, 
            this.timeDelta, 
            this.threeToJolt, 
            this.interactableObjs
        );
    }

    // this function initializes the init function and the animation loop (for our update)
    public async initUtils(): Promise<void> {
        // do a one time initalizaiton of anything we want here
        await this.init();
        // set up the update loop (NOTE: this has to be used for webXR projects)
        this.renderer.setAnimationLoop(() => {
            // update the mechanisms 
            this.update();
            // render the updated scene
            this.targetCam = (
                this.VRIsEnabled ?
                this.VR.Cam :
                this.MK.Cam
            );
            // render the scene and the camera
            this.renderer.render(this.scene, this.targetCam);
        });
        // init other miscellaneous features/fns
        this.initMisc();
    }

    // this is our start function that executes at the beginning of a script
    private async init(): Promise<void> {
        // init the physics
        await this.threeToJolt.init();
        // init the scene
        this.initScene();
    }

    // sets up the scene before running update loops
    private initScene(): void {
        // init the MK controller
        this.MK.init();
        // init the VR controller
        this.VR.init(() => {
            // this callback fn happens when VR is enabled 

            // toggle the VR is enabled boolean
            this.VRIsEnabled = true;
            // remove the MK camera
            this.scene.remove(this.MK.Cam);
            // add the VR dolly 
            this.scene.add(this.VR.Dolly);
            // and set its position
            this.VR.Dolly.position.z = 5;
        });

        // create some cubes
        const cubeOne: THREE.Mesh = this.threeToJolt.createCube(
            {width: 0.5, height: 0.5, depth: 0.5}, 
            {color: 0xff00ff},
            {position: new THREE.Vector3(3, 0, 0), rotation: new THREE.Quaternion()},
            {motionType: Jolt.EMotionType_Dynamic, layer: LAYER.MOVING, mass: 1, restitution: 0}
        );
        const cubeTwo: THREE.Mesh = this.threeToJolt.createCube(
            {width: 1, height: 1, depth: 1}, 
            {color: 0xff0000},
            {position: new THREE.Vector3(-3, 0, 0), rotation: new THREE.Quaternion()},
            {motionType: Jolt.EMotionType_Dynamic, layer: LAYER.MOVING, mass: 2, restitution: 0}
        );
        // create a floor
        const floor: THREE.Mesh = this.threeToJolt.createCube(
            {width: 10, height: 1, depth: 10}, 
            {color: 0x00ff00},
            {position: new THREE.Vector3(0, -5, 0), rotation: new THREE.Quaternion()},
            {motionType: Jolt.EMotionType_Kinematic, layer: LAYER.NON_MOVING, mass: 100, restitution: 0}
        );

        // add the objs — along with our cam and some other objs — to our scene
        const {Cam, InteractionController} = this.MK;
        this.scene.add(Cam, cubeOne, cubeTwo, floor);
        if (InteractionController.crosshair !== null) 
            this.scene.add(InteractionController.crosshair);

        // add the cubes we want to interact with to our array of interactable objs
        this.interactableObjs.push(cubeOne, cubeTwo);

        // set the camera position back slightly
        this.MK.Cam.position.z = 5;
    }

    // init any miscellaneous features/fns here
    private initMisc(): void {
        // during window resize, resize the three canvas to fit the size of the site
        window.addEventListener("resize", (ev: UIEvent) => {
            // set the size of the renderer's DOMElement
            this.renderer.setSize(window.innerWidth, innerHeight);
            // update the camera's aspect ratio
            this.targetCam?.updateProjectionMatrix();
        });
    }

    // this is our parent function that holds any functions that wants to update... similar to unity
    private update(): void {
        // update the three js meshs and associated physics objs
        this.threeToJolt.update();
        // update the time delta
        this.updateTimeDelta();
        // update the MK/VR controller depending on when VR is enabled or not
        if (this.VRIsEnabled)
            this.VR.update();
        else
            this.MK.update();
    }

    // updates time delta
    private updateTimeDelta(): void {
        this.time.update();
        this.timeDelta.current = this.time.getDelta();
    }
}
