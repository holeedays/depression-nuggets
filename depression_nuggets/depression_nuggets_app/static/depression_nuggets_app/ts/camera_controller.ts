import * as THREE from "three";
import { clamp } from "./utils.ts";

export type cameraType = "orthographic" | "perspective";

export class CameraController {
    private cam: THREE.OrthographicCamera | THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;

    // public mouseDeltaQueue: THREE.Vector2[] = [];
    public mouseDelta: THREE.Vector2 = new THREE.Vector2();
    public camRotDeg: THREE.Vector2 = new THREE.Vector2();
    public moveKeysPressed: Set<string> = new Set();
    public keysVectorMap: Record<string,THREE.Vector2> = {};

    private timeDelta: {current: number};
    private verticalSens: number;
    private horizontalSens: number;
    private moveSpeed: number;

    get Cam(): THREE.OrthographicCamera | THREE.PerspectiveCamera {
        return this.cam;
    }

    constructor(
        renderer: THREE.WebGLRenderer,
        timeDelta: {current: number},

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

        // assign the current renderer to the corresponding field
        this.renderer = renderer;
        // assign the current time delta to this time delta
        this.timeDelta = timeDelta;
        // set the sensitivity of the camera to the corresponding fields
        this.verticalSens = verticalSens;
        this.horizontalSens = horizontalSens;
        // set the movespeed of the camera to the corresponding field here too
        this.moveSpeed = moveSpeed;
    }

    // initialize the camera controller 
    public init(): void {
        // initialize the rotation controls
        this.initRotationControls();
        // initialize the movement controls with a standard set of keys
        this.initMovementControls(
            {
                UP: ["ArrowUp", "W", "w"],
                DOWN: ["ArrowDown", "S", "s"],
                LEFT: ["ArrowLeft", "A", "a"],
                RIGHT: ["ArrowRight", "D", "d"]
            }
        );
    }

    // initializes the rotation logic for the camera
    private initRotationControls(): void {
        // get the canvas element from the renderer
        const canvas: HTMLCanvasElement = this.renderer.domElement;

        // sets pointer lock on the canvas so our mouse move is unbounded by the screen space
        // also to escape from a pointer lock, just press escape like usual
        canvas.addEventListener("click", async (ev: MouseEvent) => {
            try {
                await canvas.requestPointerLock();
            } 
            catch (err) {
                console.warn("Could not request pointer lock", err);
            }
        });

        // set the actual mousemove logic
        // NOTE: document has the pointer lock element property but window doesn't
        document.addEventListener("mousemove", (ev: MouseEvent) => {
            // check that the current pointer lock element is canvas 
            if (document.pointerLockElement === canvas) {
                // movementY and movementX return the mouse delta between the past position and the current one
                // pretty neat
                // add that value to the current mouse delta (mouse delta represents the total delta of the mouse
                // in one rendering frame, updateRotation() will reset the mouse delta after every frame)
                this.mouseDelta.y += ev.movementY;
                this.mouseDelta.x += ev.movementX;
            }
        });
    }

    // setups the event listeners and fields needed to control camera movement
    private initMovementControls(
        keys: {
            UP: string[],
            DOWN: string[],
            LEFT: string[],
            RIGHT: string[],
            SHIFT?: string[]
        }
    ): void {
        // create a tuple of the keys
        const keysTuple: [string[], string[], string[], string[]] = [
            keys.UP, keys.DOWN, keys.LEFT, keys.RIGHT
        ];
        // create a corresponding tuple of directional vectors
        const directionalVectors: [THREE.Vector2, THREE.Vector2, THREE.Vector2, THREE.Vector2] = [
            new THREE.Vector2(0, -1),
            new THREE.Vector2(0, 1),
            new THREE.Vector2(-1, 0),
            new THREE.Vector2(1, 0),
        ]
        // iterate through the key tuple
        keysTuple.forEach((keyNamesArray: string[], i: number) => {
            // get the directional vector
            const directionalVector: THREE.Vector2 | undefined = directionalVectors[i];
            // this shouldn't return undefined, but I have to put this here to satisfy the compiler
            if (directionalVector === undefined)
                return;

            // loop through the key names in each key name array
            keyNamesArray.forEach((keyName: string) => {
                // map the key name to a directional vector
                this.keysVectorMap[keyName] = directionalVector;
            });
        });

        // the logic here is simple: produce a set that includes all the keys currently held down
        // in the update loop, check which keys are held down and creating a resultant vector from it
        // sadly we had to do this because keydown only accepts one keypress at a time (e.g. if you press
        // a and d, it will return a once and then multiple logs of d or vice versa) 
        window.addEventListener("keydown", (ev: KeyboardEvent) => this.moveKeysPressed.add(ev.key));
        window.addEventListener("keyup", (ev: KeyboardEvent) => this.moveKeysPressed.delete(ev.key));
    }

    // this runs in the render animation loop
    public update(): void {
        // rotate the camera  
        this.updateRotation();
        // update the movement
        this.updatePosition();
    }

    // updates the rotation/orientation of the camera
    private updateRotation(): void {
        // update the camRotDeg based on the mouse delta
        this.camRotDeg.y -= this.mouseDelta.y * this.horizontalSens * this.timeDelta.current;
        // make sure to clamp the rotatio around the x axis to prevent disorienting the user
        this.camRotDeg.x = clamp(
            this.camRotDeg.x - this.mouseDelta.x * this.horizontalSens * this.timeDelta.current,
            -90,
            90
        );

        // get the euler representation of the rotations
        // NOTE: they are in radians so we have to convert the values here
        const eulerRotY: THREE.Euler = new THREE.Euler(
            0, 
            this.camRotDeg.x * Math.PI/180, // rot around the y axis 
            0
        ); 
        const eulerRotX: THREE.Euler = new THREE.Euler(
            this.camRotDeg.y * Math.PI/180, // rot around the x axis
            0,
            0
        ); 
        // convert them to individual quaternions (to avoid gimbal lock)
        const quatRotY: THREE.Quaternion = new THREE.Quaternion().setFromEuler(eulerRotY);
        const quatRotX: THREE.Quaternion = new THREE.Quaternion().setFromEuler(eulerRotX);

        // set the rotation
        this.cam.setRotationFromQuaternion(
            // quaternion rotations do not normalize and almost all quaternion operations require normalized 
            // values for three js, hence we do this
            quatRotY.multiply(quatRotX).normalize()
        );

        // reset mouseDelta's position back to (0,0) 
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;
    }

    // updates the camera's position
    private updatePosition(): void {
        // create a vetor that holds the sum of all the vectors pressed
        const netMovementVector: THREE.Vector2 = new THREE.Vector2;
        // iterate through the set of keys pressed
        this.moveKeysPressed.values().forEach((keyName: string) => {
            // check if there is a corresponding vector to tge given key
            const directionalVector: THREE.Vector2 | undefined = this.keysVectorMap[keyName];
            if (directionalVector === undefined)
                return;
            // if so, add the the vector to the net movement vector
            netMovementVector.add(directionalVector);
        });
        // convert the net movement vector into a vector 3 so we can apply rotations and use it to update
        // the camera's position
        const netMovementVector3: THREE.Vector3 = new THREE.Vector3(
            netMovementVector.x * this.moveSpeed * this.timeDelta.current, 
            0, 
            netMovementVector.y * this.moveSpeed * this.timeDelta.current
        )
        // apply the camera's rotation to the movement vector
        netMovementVector3.applyQuaternion(this.cam.quaternion);
        // move the camera with this new movement vector
        this.cam.position.add(netMovementVector3);
    }
}