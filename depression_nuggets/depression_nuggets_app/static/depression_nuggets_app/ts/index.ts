import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

class ThreeCanvas {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private time: THREE.Timer;

    private meshes: THREE.Mesh[] = [];

    constructor (
        cameraOverloads: {
            fov: number, aspectRatio: number, nearClip: number, farClip: number
        } = {fov: 75, aspectRatio: window.innerWidth/window.innerHeight, nearClip: 0.1, farClip: 1000},
        rendererOverloads: {
            width: number, height: number
        } = {width: window.innerWidth, height: window.innerHeight}
    ) {
        // create a scene obj
        this.scene = new THREE.Scene();
        // there are actually multiple cameras in threejs
        // the params are as follows (fov, aspect ratio, near clipping plane, far clipping plane) 
        // **clipping plane refers to the bounds of how close/far the camera will render an obj
        // destructuring it here for legibility purposes
        const {fov, aspectRatio, nearClip, farClip} = cameraOverloads;
        this.camera = new THREE.PerspectiveCamera(fov, aspectRatio, nearClip, farClip);
        // set up a <canvas> element, this will render the 3D scene
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(rendererOverloads.width, rendererOverloads.height);
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
            // have to call this before any updates in the scene take place so that getDelta() actually works
            this.time.update();
            // update the mechanisms 
            this.update();
            // render the updated scene
            this.renderer.render(this.scene, this.camera);
        });
    }

    // this is our start function that executes at the beginning of a script
    private init(): void {
        // create a cube
        this.createCube();
        // set the camera position back slightly
        this.camera.position.z = 5;
    }

    // creates a cube mesh and adds it to the scene
    private createCube(): void {
        const boxGeometry: THREE.BoxGeometry = new THREE.BoxGeometry(1, 1, 1);
        // yes you can type hexadecimal values without quotation marks
        const material: THREE.Material = new THREE.MeshBasicMaterial({color: 0xff00ff});
        const cube: THREE.Mesh = new THREE.Mesh(boxGeometry, material);
        this.scene.add(cube);
        this.meshes.push(cube);
    }

    // this is our parent function that holds any functions that wants to update... similar to unity
    private update(): void {
        this.meshes.forEach((mesh: THREE.Mesh) => {
            const rotSpeed: number = 10 * this.time.getDelta();

            // mutiplying quarternions adds a new rotation on top of the old rotation
            // order matters here though: q1 (existing rot) * q2 (additional rot) applies the rotation to the object's own axes 
            // the other way around: q2 * q1 results in rotation relative to the world axes
            mesh.applyQuaternion(
                // so long as rotSpeed is not divisible by 90, we won't get gimbal lock
                new THREE.Quaternion().setFromEuler(new THREE.Euler(rotSpeed, rotSpeed, 0))
            );
        });
    }
}

const newCanvas: ThreeCanvas = new ThreeCanvas();
newCanvas.initUtils();