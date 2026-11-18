import * as THREE from "three";
import { clamp } from "./utils.ts";

export class MovementController {
    private movementObject: THREE.Object3D;
    private renderer: THREE.WebGLRenderer;

    private mouseDelta: THREE.Vector2 = new THREE.Vector2();
    private totalMouseDelta: THREE.Vector2 = new THREE.Vector2();
    private moveKeysPressed: Set<string> = new Set();
    private sprintKeySet: Set<string> = new Set();
    private keysVectorMap: Record<string,THREE.Vector2> = {};

    private timeDelta: {current: number};
    private verticalSens: number;
    private horizontalSens: number;
    private moveSpeed: number;
    private sprintSpeed: number;

    constructor(
        movementObject: THREE.Object3D,
        renderer: THREE.WebGLRenderer,
        timeDelta: {current: number},
                
        verticalSens: number = 30,
        horizontalSens: number = 40,
        moveSpeed: number = 10,
        sprintSpeed: number = 50
    ) {
        // set the outside instance references

        // this object is the transform we'll be updating and controlling
        this.movementObject = movementObject;
        this.renderer = renderer;
        this.timeDelta = timeDelta;

        // set the parameters (e.g. sensitivity and movement speed)
        this.verticalSens = verticalSens;
        this.horizontalSens = horizontalSens;
        this.moveSpeed = moveSpeed;
        this.sprintSpeed = sprintSpeed;
    }

    // initialize the movement controller 
    public init(): void {
        // initialize the rotation controls
        this.initRotationControls();
        // initialize the movement controls with a standard set of keys
        this.initMovementControls(
            {
                // use keycodes instead of key strings as using shift+key can cause desyncing issues with the way we're recording key
                // presses (e.g. shift+a results in shift A but if we release shift and then a, the keyup event will only remove shift and a,
                // not capital A)
                UP: ["ArrowUp", "KeyW"],
                DOWN: ["ArrowDown", "KeyS"],
                LEFT: ["ArrowLeft", "KeyA"],
                RIGHT: ["ArrowRight", "KeyD"],
                SPRINT: ["ShiftLeft"]
            }
        );
    }

    // initializes the rotation logic 
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

    // setups the event listeners and fields needed to control positional movement
    private initMovementControls(
        keys: {
            UP: string[],
            DOWN: string[],
            LEFT: string[],
            RIGHT: string[],
            SPRINT: string[]
        }
    ): void {
        // create a tuple of the directional keys
        const directionalKeysTuple: [string[], string[], string[], string[]] = [
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
        directionalKeysTuple.forEach((keyNamesArray: string[], i: number) => {
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

        // create a key set of the sprint key (to be used later) and assign it to the global var sprintKeySet
        this.sprintKeySet = new Set(keys.SPRINT);
        // the logic here is simple: produce a set that includes all the keys currently held down
        // in the update loop, check which keys are held down and creating a resultant vector from it
        // sadly we had to do this because keydown only accepts one keypress at a time (e.g. if you press
        // a and d, it will return a once and then multiple logs of d or vice versa) 
        window.addEventListener("keydown", (ev: KeyboardEvent) => this.moveKeysPressed.add(ev.code));
        window.addEventListener("keyup", (ev: KeyboardEvent) => this.moveKeysPressed.delete(ev.code));
    }

    // this runs in the render animation loop
    public update(): void {
        // rotate the object  
        this.updateRotation();
        // update the movement
        this.updatePosition();
    }

    // updates the rotation/orientation 
    private updateRotation(): void {
        // update the delta based on the mouse delta
        // make sure to clamp the value for the y delta (rotation around the x axis in euler coords) to prevent disorienting the user
        this.totalMouseDelta.y = clamp(
            this.totalMouseDelta.y - this.mouseDelta.y * this.verticalSens * this.timeDelta.current,
            -90,
            90
        );
        this.totalMouseDelta.x -= this.mouseDelta.x * this.horizontalSens * this.timeDelta.current;

        // get the euler representation of the rotations
        // NOTE: they are in radians so we have to convert the values here
        const eulerRotY: THREE.Euler = new THREE.Euler(
            0, 
            this.totalMouseDelta.x * Math.PI/180, // rot around the y axis 
            0
        ); 
        const eulerRotX: THREE.Euler = new THREE.Euler(
            this.totalMouseDelta.y * Math.PI/180, // rot around the x axis
            0,
            0
        ); 
        // convert them to individual quaternions (to avoid gimbal lock)
        const quatRotY: THREE.Quaternion = new THREE.Quaternion().setFromEuler(eulerRotY);
        const quatRotX: THREE.Quaternion = new THREE.Quaternion().setFromEuler(eulerRotX);

        // set the rotation
        this.movementObject.setRotationFromQuaternion(
            // quaternion rotations do not normalize and almost all quaternion operations require normalized 
            // values for three js, hence we do this
            quatRotY.multiply(quatRotX).normalize()
        );

        // reset mouseDelta's position back to (0,0) 
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;
    }

    // updates the movement object's position
    private updatePosition(): void {
        // create a boolean that flags whether a sprint key is pressed or not
        let sprintKeyPressed: boolean = false;
        // create a vector that holds the sum of all the vectors pressed
        const netMovementVector: THREE.Vector2 = new THREE.Vector2;
        // iterate through the set of keys pressed
        this.moveKeysPressed.values().forEach((keyName: string) => {
            // check if the sprint key is pressed
            if (this.sprintKeySet.has(keyName)) {
                // if so, set the sprintKeyPressed bool flag to true
                sprintKeyPressed = true;
                // move onto the next loop
                return;
            }

            // check if there is a corresponding vector to the given key
            const directionalVector: THREE.Vector2 | undefined = this.keysVectorMap[keyName];
            if (directionalVector === undefined)
                return;
            // if so, add the the vector to the net movement vector
            netMovementVector.add(directionalVector);
        });

        // get the target move speed based on whether the sprint key was pressed or not
        const targetMoveSpeed: number = sprintKeyPressed ? this.sprintSpeed : this.moveSpeed;
        // convert the net movement vector into a vector 3 so we can apply rotations and use it to update
        // the object's position
        const netMovementVector3: THREE.Vector3 = new THREE.Vector3(
            netMovementVector.x * targetMoveSpeed * this.timeDelta.current, 
            0, 
            netMovementVector.y * targetMoveSpeed * this.timeDelta.current
        )
        // apply the object's rotation to the movement vector
        netMovementVector3.applyQuaternion(this.movementObject.quaternion.clone());
        // move the object with this new movement vector
        this.movementObject.position.add(netMovementVector3);
    }
}