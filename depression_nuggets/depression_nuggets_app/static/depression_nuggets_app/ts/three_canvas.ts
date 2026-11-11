import * as THREE from "three";
import { JoltPhysics, type JoltPhysicsObject } from 'three/addons/physics/JoltPhysics.js';

import { CameraController } from "./camera_controller.ts";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class ThreeCanvas {
    private scene: THREE.Scene;
    private camera: CameraController;
    private renderer: THREE.WebGLRenderer;
    private time: THREE.Timer;
    private timeDelta: {current: number} = {current: 0};
    private physics: JoltPhysicsObject | null = null;

    private meshes: THREE.Mesh[] = [];

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
        // create a camera, pass the renderer object and timeDelta obj to it
        this.camera = new CameraController(this.renderer, this.timeDelta);
        this.camera.init();
        // add it to our DOM
        document.body.appendChild(this.renderer.domElement);
        // also set up a timer so we can get delta time
        this.time = new THREE.Timer();
        // connect it to the native page visibility API to avoid overflows when the page is not closed
        this.time.connect(document);
    }

    // this function initializes the init function and the animation loop (for our update)
    public initUtils(): void {
        // do a one time initalizaiton of anything we want here
        this.init();
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
        // set our physics engine 
        this.physics = await JoltPhysics();
        // create a cube
        const cube: THREE.Mesh = this.createCube();
        // add it to our array of meshes
        this.meshes.push(cube);
        // // add it to the physics
        // this.physics.addMesh(cube, 10, 0);
        // set the camera position back slightly
        this.camera.Cam.position.z = 5;
    }

    // creates a cube mesh and adds it to the scene
    private createCube(): THREE.Mesh {
        const boxGeometry: THREE.BoxGeometry = new THREE.BoxGeometry(1, 1, 1);
        // yes you can type hexadecimal values without quotation marks
        const material: THREE.Material = new THREE.MeshBasicMaterial({color: 0xff00ff});
        const cube: THREE.Mesh = new THREE.Mesh(boxGeometry, material);
        this.scene.add(cube);

        return cube;
    }

    // this is our parent function that holds any functions that wants to update... similar to unity
    private update(): void {
        // update the time delta
        this.updateTimeDelta();
        // update the meshes
        this.updateMeshes();
        // update the camera
        this.camera.update();
    }

    // updates the meshes in the scene
    private updateMeshes(): void {
        this.meshes.forEach((mesh: THREE.Mesh) => {
            const rotSpeed: number = 1 * this.timeDelta.current;

            // mutiplying quarternions adds a new rotation on top of the old rotation
            // order matters here though: q1 (existing rot) * q2 (additional rot) applies the rotation to the object's own axes 
            // the other way around: q2 * q1 results in rotation relative to the world axes
            mesh.applyQuaternion(
                // so long as rotSpeed is not divisible by 90, we won't get gimbal lock
                new THREE.Quaternion().setFromEuler(new THREE.Euler(rotSpeed, rotSpeed, 0))
            );
        });
    }

    // updates time delta
    private updateTimeDelta(): void {
        this.time.update();
        this.timeDelta.current = this.time.getDelta();
    }
}
