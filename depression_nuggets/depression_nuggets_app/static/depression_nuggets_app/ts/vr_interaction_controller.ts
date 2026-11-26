import * as THREE from "three";
import { InteractionControllerBase } from "./interaction_controller_base.ts";
import { ThreeToJolt } from "./threeToJolt.ts";

export class VRInteractionController extends InteractionControllerBase {
    private controllers: { 
        left: THREE.XRTargetRaySpace, 
        right: THREE.XRTargetRaySpace,
        leftGrip: THREE.XRGripSpace,
        rightGrip: THREE.XRGripSpace
    } | null = null;
    
    private activeInteractions: {
        left: {
            intersection: THREE.Intersection, 
            initialLocalMatrix: THREE.Matrix4
        } | null,
        right: {
            intersection: THREE.Intersection, 
            initialLocalMatrix: THREE.Matrix4
        } | null
    } = {left: null, right: null};
    private isSelectingLeft: boolean = false;
    private isSelectingRight: boolean = false;

    get Controllers(): { 
        left: THREE.XRTargetRaySpace, 
        right: THREE.XRTargetRaySpace,
        leftGrip: THREE.XRGripSpace,
        rightGrip: THREE.XRGripSpace
    } | null {
        return this.controllers;
    }

    set Controllers(
        newControllerValue: {
            left: THREE.XRTargetRaySpace, 
            right: THREE.XRTargetRaySpace,
            leftGrip: THREE.XRGripSpace,
            rightGrip: THREE.XRGripSpace
        } | null
    ) {
        this.controllers = newControllerValue;
    }

    constructor(
        threeToJolt: ThreeToJolt,
        sceneObjs: THREE.Object3D[],

        raycastNear: number = 0,
        raycastFar: number = Number.POSITIVE_INFINITY,
    ) {
        // init the base class/interface
        super(threeToJolt, sceneObjs, raycastNear, raycastFar);
    }

    public init(): void {
        // init the controllers (and their associated event logic)
        this.initInteractionControls();
        // init the raycast geometry (mainly for visual purposes)
        this.initRaycasterGeometry();
    };

    // init the controllers field and add the event logic tied to each controller
    protected initInteractionControls(): void {
        if (this.controllers === null) {
            console.warn("The controllers haven't been initialized");
            return;
        }

        // create the callback fns

        // event fired when the select key of the controller is pressed (this is the forward facing button on
        // the quest controller)
        const onSelectStart: THREE.EventListener<
            {data: XRInputSource}, 
            "selectstart", 
            THREE.XRTargetRaySpace
        > = (
            ev: {data: XRInputSource;} & 
            THREE.Event<"selectstart", 
            THREE.XRTargetRaySpace>
        ) => {
            if (this.controllers === null)
                return;

            if (ev.target === this.controllers.left)
                this.isSelectingLeft = true;
            if (ev.target === this.controllers.right)
                this.isSelectingRight = true;
        };

        // event fired when the select key of the controller is released 
        const onSelectEnd: THREE.EventListener<
            {data: XRInputSource}, 
            "selectend", 
            THREE.XRTargetRaySpace
        > = (
            ev: {data: XRInputSource;} & 
            THREE.Event<"selectend", 
            THREE.XRTargetRaySpace>
        ) => {
            if (this.controllers === null)
                return;
            
            if (ev.target === this.controllers.left)
                this.isSelectingLeft = false;
            if (ev.target === this.controllers.right)
                this.isSelectingRight = false;
        }


        // now add the event callback fns to their respective controllers

        // destructure the left/right controller for legibility purposes
        const {left, right} = this.controllers;

        // attach selectstart and selectend event listeners to both controllers
        left.addEventListener("selectstart", onSelectStart);
        left.addEventListener("selectend", onSelectEnd);
        right.addEventListener("selectstart", onSelectStart);
        right.addEventListener("selectend", onSelectEnd);
    };

    // inits the lines that come out of the VR controllers
    private initRaycasterGeometry(): void {
        if (this.controllers === null) {
            console.warn("Controllers field has not been initialized");
            return;
        }

        // create a new geometry pointing towards the camera's forward
        const geometry: THREE.BufferGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1)
        ]);

        // create a line from the given geometry
        const lineMaterial: THREE.LineBasicMaterial = new THREE.LineBasicMaterial({color: 0xffff00});
        const line: THREE.Line = new THREE.Line(geometry, lineMaterial);
        line.name = "line";
        // scale the z, longer would be fine in this case
        line.scale.z = 50;  

        // parent a copy of the line to the controllers
        this.controllers.left.add(line.clone());
        this.controllers.right.add(line.clone());
    }

    // updates the interaction controller, run this thru the render loop
    public update(): void {
        // get the raycast results at this frame
        const raycastResults: [THREE.Intersection[], THREE.Intersection[]] = this.updateRaycasts();
        // update interaction logic with the results
        this.updateInteractionLogic(raycastResults);
        // update active interactions if there are any
        this.updateActiveInteractions();
    };

    // raycasts from the current position of the controllers and returns a tuple of intersecting results
    protected updateRaycasts(): [THREE.Intersection[], THREE.Intersection[]] {
        if (this.controllers === null) {
            console.warn("Controllers are not initialized");
            return [[], []];
        }

        // destructure the left and right controllers
        const {left, right} = this.controllers;

        /*
            since the controllers are children of the dolly, 
            we need to get the world quaternions and positions for our raycasting logic
        */

        // create quaternions to hold the left/right controller world quaternions
        const leftControllerWorldQuat: THREE.Quaternion = new THREE.Quaternion();
        const rightControllerWorldQuat: THREE.Quaternion = new THREE.Quaternion();
        // also create vector3s to hold the world positions as well
        const leftControllerWorldPos: THREE.Vector3 = new THREE.Vector3();
        const rightControllerWorldPos: THREE.Vector3 = new THREE.Vector3();
        // set the quaternions and positions
        left.getWorldQuaternion(leftControllerWorldQuat);
        right.getWorldQuaternion(rightControllerWorldQuat);
        left.getWorldPosition(leftControllerWorldPos);
        right.getWorldPosition(rightControllerWorldPos);

        // get the directions for where the raycast should be looking at
        const leftControllerForward: THREE.Vector3 = (
            new THREE.Vector3(0, 0, -1).applyQuaternion(leftControllerWorldQuat)
        );
        const rightControllerForward: THREE.Vector3 = (
            new THREE.Vector3(0, 0, -1).applyQuaternion(rightControllerWorldQuat)
        );

        // create the raycasts with the origin at each controller's respective position and their forward pos
        const leftControllerRaycaster: THREE.Raycaster = new THREE.Raycaster(
            leftControllerWorldPos,
            leftControllerForward
        );
        const rightControllerRaycaster: THREE.Raycaster = new THREE.Raycaster(
            rightControllerWorldPos,
            rightControllerForward
        );

        // return the results as a tuple of left controller intersections and right controller intersections
        return [
            leftControllerRaycaster.intersectObjects(this.interactableSceneObjs),
            rightControllerRaycaster.intersectObjects(this.interactableSceneObjs)
        ];
    };

    // updates the interaction logic of the left and right controller based on the current raycast results
    protected updateInteractionLogic(raycastResults: [THREE.Intersection[], THREE.Intersection[]]): void {
        if (this.controllers === null) {
            console.warn("Controllers are not initialized");
            return;
        }

        // get the results for each independent controller from the raycast results tuple
        const leftControllerResults: THREE.Intersection[] = raycastResults[0];
        const rightControllerResults: THREE.Intersection[] = raycastResults[1];

        // check the event logic relating to the left controller

        /*
            if the raycast is intersecting with stuff and we are currently pressing the select/trigger button on the controller 
            and the active interaction's left property currently doesn't have a reference
        */
        if (
            leftControllerResults.length > 0 &&
            this.isSelectingLeft &&
            this.activeInteractions.left === null
        ) {
            // pick up the object
            this.activeInteractions.left = this.activateInteraction(this.controllers.left, leftControllerResults); 
        }
        // if the select button on the controller is released and something is being held on the left controller
        else if (
            !this.isSelectingLeft &&
            this.activeInteractions.left !== null 
        ) {
            // drop the object
            this.activeInteractions.left = this.deactivateInteraction(this.activeInteractions.left);

        }
        // if nothing is being held currently
        else if (this.activeInteractions === null) {
            /*
                indicate we aren't pressing the select button currently (prevents unexpected pick ups if the button is 
                consistently held down without initially pointing at something to begin with
            */
            this.isSelectingLeft = false;
        }
        

        // check the event logic relating to the right controller; do the same thing as the left controller's logic
        if (
            rightControllerResults.length > 0 &&
            this.isSelectingRight &&
            this.activeInteractions.right === null
        ) {
            this.activeInteractions.right = this.activateInteraction(this.controllers.right, leftControllerResults); 
        }
        else if (
            !this.isSelectingRight &&
            this.activeInteractions.right !== null 
        ) {
            this.activeInteractions.right = this.deactivateInteraction(this.activeInteractions.right);

        }
        else if (this.activeInteractions.right === null) {
            this.isSelectingRight = false;
        }
    };

    // handles the initial "pick-up" stage of the interaction (e.g. player picks up with the obj)
    private activateInteraction(
        controller: THREE.XRTargetRaySpace, 
        raycastResults: THREE.Intersection[]
    ): {intersection: THREE.Intersection, initialLocalMatrix: THREE.Matrix4} | null {
        // get the closest obj interacted with
        const closestRaycastIntersection: THREE.Intersection | undefined = raycastResults[0];
        // this will never happen but typescript demands this check
        if (closestRaycastIntersection === undefined)
            return null;

        // get the obj from the intersection
        const raycastedObj: THREE.Object3D = closestRaycastIntersection.object;
        // get its world matrix 
        const raycastedObjWorldMatrix: THREE.Matrix4 = raycastedObj.matrixWorld.clone();
        // as well as the controller's matrix
        const controllerWorldMatrix: THREE.Matrix4 = controller.matrixWorld.clone();

        // pause the physics for the obj
        this.threeToJolt.pausePhysicsForThreeObj(raycastedObj);

        // return an active interaction obj (this will be assigned to the corresponding property in the global activeInteractions obj)
        return {
            intersection: closestRaycastIntersection,
            initialLocalMatrix: controllerWorldMatrix.invert().multiply(raycastedObjWorldMatrix)
        };
    }

    // handles the "dropping" stage of the interaction (e.g. players drops the obj)
    private deactivateInteraction(
        currentActiveInteraction: {
            intersection: THREE.Intersection,
            initialLocalMatrix: THREE.Matrix4
        }
    ): null {
        // get the interacted obj
        const interactedObj: THREE.Object3D = currentActiveInteraction.intersection.object;
        // resume the physics body associated with this obj
        this.threeToJolt.resumePhysicsForThreeObj(interactedObj);
        // return null (this will be assigned to the corresponding property in the global activeInteractions obj)
        return null;
    }

    // updates any active interactions for the left and right controllers
    private updateActiveInteractions(): void {
        if (this.controllers === null) {
            return;
        }

        if (this.activeInteractions.left !== null)
            this.updateActiveInteraction(this.controllers.left, this.activeInteractions.left);
        if (this.activeInteractions.right !== null)
            this.updateActiveInteraction(this.controllers.right, this.activeInteractions.right);    
    }

    // updates an active interaction provided the given controller and the current active interaction obj
    protected updateActiveInteraction(
        controller: THREE.XRTargetRaySpace,
        currentActiveInteraction: {
            intersection: THREE.Intersection,
            initialLocalMatrix: THREE.Matrix4
        }
    ): void {
        // destructure the intersection obj and the initial local matrix from the active interaction obj
        const {intersection, initialLocalMatrix} = currentActiveInteraction;

        // get the interacted obj from the intersection
        const interactedObj: THREE.Object3D = intersection.object;

        // get the world matrix of the controller 
        const controllerWorldMatrix: THREE.Matrix4 = controller.matrixWorld.clone();
        // the resultant matrix is = current controller world transform matrix x local transformation matrix during time of pickup
        // (read right to left)
        const resultantMatrix: THREE.Matrix4 = controllerWorldMatrix.multiply(initialLocalMatrix);
        
        // create vars to hold the new pos, quat, and scale resulting from the resultant matrix
        const newPos: THREE.Vector3 = new THREE.Vector3();
        const newQuat: THREE.Quaternion = new THREE.Quaternion();
        const newScale: THREE.Vector3 = new THREE.Vector3();

        // decomposing the matrix separates the matrix into its different components, we can then just handle each component separately (this is
        // more convenient than setting the matrix explicitly)
        resultantMatrix.decompose(
            newPos,
            newQuat,
            newScale
        );

        // update the physics body associated with this obj and as this mesh itself as well
        // currently, scale is not monitored, it will be added later if anything will have their transforms skewed
        this.threeToJolt.updateThreeToJoltBody(interactedObj, newPos, newQuat, false);
    }
}