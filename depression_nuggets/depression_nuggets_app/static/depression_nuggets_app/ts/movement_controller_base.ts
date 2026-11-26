import * as THREE from "three";

// functions as an interface class for any movement controllers
export abstract class MovementControllerBase {
    protected renderer: THREE.WebGLRenderer;
    protected movementObject: THREE.Object3D;
    protected timeDelta: {current: number};

    protected verticalSens: number;
    protected horizontalSens: number;
    protected moveSpeed: number;
    protected sprintSpeed: number;

    constructor(
        renderer: THREE.WebGLRenderer,
        movementObject: THREE.Object3D,
        timeDelta: {current: number},

        verticalSens: number,
        horizontalSens: number,
        moveSpeed: number,
        sprintSpeed: number
    ) {
        // references
        this.renderer = renderer;
        this.movementObject = movementObject;
        this.timeDelta = timeDelta;

        // params
        this.verticalSens = verticalSens;
        this.horizontalSens = horizontalSens;
        this.moveSpeed = moveSpeed;
        this.sprintSpeed = sprintSpeed;
    }

    public abstract init(): void;
    protected abstract initRotationControls(): void;
    protected abstract initMovementControls(...args: any[]): void;

    public abstract update(): void;
    protected abstract updateRotation(...args: any[]): void;
    protected abstract updatePosition(...args: any[]): void;
}