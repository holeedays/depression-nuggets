import * as THREE from "three";
import { clamp } from "./utils.ts";
import { MovementControllerBase } from "./movement_controller_base.ts";

export interface XRInputData {
    handedness: XRHandedness,
    /*
        buttons has 4+ indices:

        - buttons[0]: primary trigger
        - buttons[1]: primary squeeze (grip)
        - buttons[2]: primary touchpad
        - buttons[3]: primary thumbstick <-- what we want
        - buttons[4]+: additional face or secondary buttons (if present)
    */
    buttons: Readonly<GamepadButton[]>,
    /*
        axes has 4 indices:

        - axes[0], axes[1]: primary X, Y touchpad
        - axes[2], axes[3]: primary X (left, right), Y (up, down) thumbstick <-- what we want
    */
    axes: Readonly<number[]>
}

export class VRMovementController extends MovementControllerBase {
    private currentHorizontalSens: number;
    private maxHorizontalSens: number;
    private horizontalSensAccelerationRate: number;
    private horizontalSensAccelerationThreshold: number;

    private currentMoveSpeed: number;
    private maxMoveSpeed: number;
    private moveSpeedAcelerationRate: number;
    private moveSpeedAccelerationThreshold: number;

    constructor(
        renderer: THREE.WebGLRenderer,
        movementObject: THREE.Object3D,
        timeDelta: {current: number},

        verticalSens: number,
        horizontalSens: number,
        maxHorizontalSens: number,
        horizontalAccelerationRate: number,
        horizontalAccelerationThreshold: number,

        moveSpeed: number,
        maxMoveSpeed: number,
        moveSpeedAccelerationRate: number,
        moveSpeedAccelerationThreshold: number,
        sprintSpeed: number
    ) {
        // init the base interface class
        super(renderer, movementObject, timeDelta, verticalSens, horizontalSens, moveSpeed, sprintSpeed);

        // init the additional params
        this.currentHorizontalSens = horizontalSens;
        this.maxHorizontalSens = maxHorizontalSens;
        this.horizontalSensAccelerationRate = horizontalAccelerationRate;
        this.horizontalSensAccelerationThreshold = horizontalAccelerationThreshold;

        this.currentMoveSpeed = moveSpeed;
        this.maxMoveSpeed = maxMoveSpeed;
        this.moveSpeedAcelerationRate = moveSpeedAccelerationRate;
        this.moveSpeedAccelerationThreshold = moveSpeedAccelerationThreshold;
    }
    
    public init(): void {

    }

    protected initRotationControls(): void {

    }

    protected initMovementControls(): void {
    }

    // run this in the render loop
    public update(): void {
        const XRSession: XRSession | null = this.renderer.xr.getSession();

        if (XRSession === null) {
            console.warn("XR session is not enabled");
            return;
        }

        // access the native XR API by mozilla
        XRSession.inputSources.forEach((inputSource: XRInputSource) => {
            if (inputSource.gamepad === undefined) {
                console.warn("There is no gamepad that exists for this input source: ", inputSource);
                return;
            }

            // wrap all the relevant inputs into a js obj
            const controllerData: XRInputData = {
                handedness: inputSource.handedness,
                buttons: inputSource.gamepad.buttons,
                axes: inputSource.gamepad.axes
            };

            // check which controller this data belongs to

            // if the controller is the right one, then update rotations
            if (controllerData.handedness === "right")
                this.updateRotation(controllerData);
            if (controllerData.handedness === "left")
                this.updatePosition(controllerData);
        });
    }

    // updates the rotation of the dolly
    protected updateRotation(rightControllerData: XRInputData): void {
        /*
            - buttons[0]: primary trigger
            - buttons[1]: primary squeeze (grip)
            - buttons[2]: primary touchpad
            - buttons[3]: primary thumbstick <-- what we want
            - buttons[4]+: additional face or secondary buttons (if present)
        */

        /*
            - axes[0], axes[1]: primary X, Y touchpad
            - axes[2], axes[3]: primary X (left, right), Y (up, down) thumbstick <-- what we want
        */

        // get how much the paddle has moved on the X axes; value is normalized between [-1, 1]
        const paddleHorizontalShift: number = rightControllerData.axes[2] ?? 0;

        /*
            horizontal rotation (around the y axis) will accelerate towards a max horizontal sens rate

            however, this requires that the paddle is almost shifted all the way for it to accelerate, or else
            it'll just go back to the base horizontal sens
        */
        if (Math.abs(paddleHorizontalShift) > this.horizontalSensAccelerationThreshold) {
            this.currentHorizontalSens = clamp(
                this.currentHorizontalSens * this.horizontalSensAccelerationRate, 
                this.horizontalSens, 
                this.maxHorizontalSens
            );
        }
        else {
            this.currentHorizontalSens = this.horizontalSens;
        }

        // now calculate the rotation in degrees
        const targetRotationDeg: number = (
            -paddleHorizontalShift * this.currentHorizontalSens * this.timeDelta.current
        );

        // rotate the dolly by the rotation (convert it to radians first though)
        this.movementObject.rotateY(
            targetRotationDeg * Math.PI/180
        );
    }

    // updates the position of the dolly
    protected updatePosition(leftControllerData: XRInputData): void {
        /*
            - buttons[0]: primary trigger
            - buttons[1]: primary squeeze (grip)
            - buttons[2]: primary touchpad
            - buttons[3]: primary thumbstick <-- what we want
            - buttons[4]+: additional face or secondary buttons (if present)
        */

        /*
            - axes[0], axes[1]: primary X, Y touchpad
            - axes[2], axes[3]: primary X (left, right), Y (up, down) thumbstick <-- what we want
        */

        // get how much the paddles has moved on the axes
        const paddleHorizontalShift: number = leftControllerData.axes[2] ?? 0;
        const paddleVerticalShift: number = leftControllerData.axes[3] ?? 0;

        // calculate the normalized movement vector pointing in the same direction as the dolly's forward
        const movementVector: THREE.Vector3 = (
            new THREE.Vector3(paddleHorizontalShift, 0, paddleVerticalShift)
            .applyQuaternion(this.movementObject.quaternion.clone())
            .normalize()
        );

        /*
            buttons[3] represents the thumbstick button

            like all buttons, thumbstick presses range from [0, 1] (0 = not pressed, 1 = fully pressed)
            however, unlike the controller grip buttons, thumbstick doesn't have a gradient value
            (e.g. thumbstick values is either 0 or 1, not in between)

            as such, we can just determine if the thumbstick is being pressed if it isn't 0 or > 0
            the thumbstick press will determine if we are sprinting or not
        */
        const isSprinting: boolean = (leftControllerData.buttons[3]?.value ?? 0) > 0;
        // get additional movement speed based on whether the thumbstick is pressed or not
        const sprintDiff: number = isSprinting ? this.sprintSpeed - this.moveSpeed : 0;

        // like updateRotation(), updatePosition() also has a gradual acceleration mechanic (on top of the sprint speed)
    
        // if the normalized shift is greater than the acceleration threshold
        if (
            Math.max(
                Math.abs(paddleHorizontalShift), Math.abs(paddleVerticalShift)
            ) > this.moveSpeedAccelerationThreshold
        ) {
            // update the move speed
            this.currentMoveSpeed = clamp(
                this.currentMoveSpeed * this.moveSpeedAcelerationRate,
                this.moveSpeed + sprintDiff,
                this.maxMoveSpeed + sprintDiff
            );
        }
        else {
            // else put it back to the base move speed
            this.currentMoveSpeed = this.moveSpeed;
        }

        this.movementObject.position.add(
            movementVector.multiplyScalar(this.currentMoveSpeed * this.timeDelta.current)
        );
    }   
}