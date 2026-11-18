import * as THREE from "three";
import { ThreeToJolt } from "./threeToJolt.ts";
import { Jolt, LAYER } from "./physics.ts";

import { CameraController } from "./camera_controller.ts";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class ThreeCanvas {
    private scene: THREE.Scene;
    private renderer: THREE.WebGLRenderer;
    private time: THREE.Timer;
    private timeDelta: {current: number} = {current: 0};

    private threeToJolt: ThreeToJolt;
    private camera: CameraController;
    private sceneObjs: THREE.Object3D[] = [];

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
        // create a camera, pass the renderer, timeDelta, physics, and sceneObjs
        this.camera = new CameraController(this.renderer, this.timeDelta, this.threeToJolt, this.sceneObjs);
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
            this.renderer.render(this.scene, this.camera.Cam);
        });
    }

    // this is our start function that executes at the beginning of a script
    private async init(): Promise<void> {
        // init the physics
        await this.threeToJolt.init();
        // init the scene
        this.initScene();

    }

    private initScene(): void {
        // init the camera controller
        this.camera.init();
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
        const floor: THREE.Mesh = this.threeToJolt.createCube(
            {width: 10, height: 1, depth: 10}, 
            {color: 0x00ff00},
            {position: new THREE.Vector3(0, -5, 0), rotation: new THREE.Quaternion()},
            {motionType: Jolt.EMotionType_Kinematic, layer: LAYER.NON_MOVING, mass: 100, restitution: 0}
        );

        // add the objs — along with our cam and some other objs — to our scene
        const {Cam, InteractionController} = this.camera;
        this.scene.add(Cam, cubeOne, cubeTwo, floor);
        if (InteractionController.crosshair !== null) 
            this.scene.add(InteractionController.crosshair);

        // add it to our array of scene objs
        this.sceneObjs.push(cubeOne, cubeTwo);
        // add some of the objs to the physics
        // this.physics.addMesh(cubeOne, 10, 0);
        // this.physics.addMesh(cubeTwo, 10, 0);
        // this.physics.addMesh(floor, 0, 0);

        // set the camera position back slightly
        this.camera.Cam.position.z = 5;
    }

    // this is our parent function that holds any functions that wants to update... similar to unity
    private update(): void {
        // update the three js meshs and associated physics objs
        this.threeToJolt.update();
        // update the time delta
        this.updateTimeDelta();
        // update the camera
        this.camera.update();
    }

    // updates time delta
    private updateTimeDelta(): void {
        this.time.update();
        this.timeDelta.current = this.time.getDelta();
    }
}
