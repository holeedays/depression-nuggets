import * as THREE from "three";
import { InteractionControllerBase } from "./interaction_controller_base.ts";
import { ThreeToJolt } from "./threeToJolt.ts";


export class MKInteractionController extends InteractionControllerBase {
    private interactionOrigin: THREE.Object3D;
    private activeInteraction: {
        intersection: THREE.Intersection, 
        initialLocalMatrix: THREE.Matrix4
    } | null = null;
    private interactionControlToggled: boolean = false;

    private crosshairSize: THREE.Vector3;
    private crosshairDist: number;
    public crosshair: THREE.Sprite | null = null;

    constructor(
        interactionOrigin: THREE.Object3D, 
        threeToJolt: ThreeToJolt,
        sceneObjs: THREE.Object3D[],

        raycastNear: number,
        raycastFar: number,
        crosshairSize: THREE.Vector3,
        crosshairDist: number
    ) {
        // init the base class/interface
        super(threeToJolt, sceneObjs, raycastNear, raycastFar);

        // init other references
        this.interactionOrigin = interactionOrigin;

        // init the additional params
        this.crosshairSize = crosshairSize;
        this.crosshairDist = crosshairDist;
    }

    // inits the interaction controller
    public init(): void {
        // init interaction controls
        this.initInteractionControls(["E", "e"], true);
        // inits the crosshair
        this.initCrosshair();
    }

    // initializes interaction controls
    protected initInteractionControls(
        interactionKeys: string[] | null,
        useMouse: boolean
    ): void {

        // if an array of interaction keys has been passed
        if (interactionKeys !== null) {
            // add key press event listener logic 

            // have a set to hold all the available interaction keys
            const interactionKeySet: Set<string> = new Set(interactionKeys);

            // handle keyup logic here... we want key up because we don't want to allow holding down a key constantly to count as
            // a valid key press (would function kind of funkily)
            window.addEventListener("keyup", (ev: KeyboardEvent) => {
                // if the key pressed is included in the set
                if (interactionKeySet.has(ev.key)) {
                    // set the interaction control toggled to true
                    this.interactionControlToggled = true;
                }
            });
        }

        // if use mouse is enabled
        if (useMouse) {
            // handle mouse down logic here
            window.addEventListener("click", (ev: MouseEvent) => {
                this.interactionControlToggled = true;
            });
        }
    }

    // creates a crosshair sprite and stores the instance
    protected initCrosshair(): void {
        const djangoConfig: HTMLDivElement | null = document.querySelector("#django-config");
        if (djangoConfig === null) {
            console.warn("Django config doesn't exist");
            return;
        }

        // get the static assets path from the django config
        const staticPath: string | undefined = djangoConfig.dataset.staticPath;
        if (staticPath === undefined) {
            console.warn("Static path attribute has not been configured on the django config");
            return;
        }

        // load the image as a texture
        const map: THREE.Texture = new THREE.TextureLoader().load(staticPath + "depression_nuggets_app/decals/crosshair.png");
        // set it to a sprite material
        const material: THREE.SpriteMaterial = new THREE.SpriteMaterial({ map: map });
        // set the newly created sprite to the crosshair variable
        this.crosshair = new THREE.Sprite(material);

        // change the scale of the sprite
        this.crosshair.scale.copy(this.crosshairSize);

        // was originally going to child the sprite to the interaction obj but I'd figure I'll do it later if more complex setups
        // are required, we will stick with manually updating position for now and will add the sprite hair in the three_canvas instance
    }

    // updates the interaction handling
    // put this in the render loop
    public update(): void {
        // update raycasting
        const raycastResults: THREE.Intersection[] = this.updateRaycasts();
        // update the interaction logic based on the raycast results
        this.updateInteractionLogic(raycastResults);
        // update the active interactions (if there are any)
        this.updateActiveInteraction();
        // and update the crosshair
        this.updateCrosshair(raycastResults);
    }

    // handles raycasting in the update loop and returns the results
    protected updateRaycasts(): THREE.Intersection[] {
        if (this.interactionOrigin === null)
            return [];

        // get the forward vector of the interaction origin 
        const currentForwardDir: THREE.Vector3 = this.interactionOrigin.getWorldDirection(new THREE.Vector3());
        const currentPos: THREE.Vector3 = this.interactionOrigin.position;

        // create a new raycaster
        const raycaster: THREE.Raycaster = new THREE.Raycaster(
            currentPos,
            currentForwardDir,
            this.raycastNear,
            this.raycastFar
        );

        // return the objects the raycaster has intersected with 
        return raycaster.intersectObjects(this.interactableSceneObjs);
    }

    // handles interaction logic with the given raycasted results
    protected updateInteractionLogic(raycastResults: THREE.Intersection[]): void {
        // if a key/mouse pressed was toggled in this frame and we are not currently holding anything and the raycast actually hit something
        if (
            this.interactionControlToggled && 
            this.activeInteraction === null &&
            raycastResults.length > 0
        ) {
            // get the closest intersection object (raycaster.intersectObjects() always returns intersections based on ascending distance
            // [so closest --> farthest])

            // we don't technically need the undefined check but the typescript compiler needs to be certain an indexed value
            // actually exists
            const closestRaycastedIntersection: THREE.Intersection | undefined = raycastResults[0];
            if (closestRaycastedIntersection === undefined)
                return;

            // set the obj to the global activeInteraction var along with some other metadata
            // make sure to clone any quaternions/vector3s/matrices cause they're reference types and mutating them directly can cause
            // unaffected side effects
            const raycastedObj: THREE.Object3D = closestRaycastedIntersection.object;
            // get the world matrix of the raycasted obj
            const raycastedObjWorldMatrix: THREE.Matrix4 = raycastedObj.matrix.clone();
            // get the world matrix of the interaction origin
            const originWorldMatrix: THREE.Matrix4 = this.interactionOrigin.matrix.clone();
            
            // also handle the physics here
            // essentially just pause the physics for the physics obj associated with this raycasted obj
            this.threeToJolt.pausePhysicsForThreeObj(raycastedObj);

            this.activeInteraction = {
                intersection: closestRaycastedIntersection, 
                // since both matrices are in world space and we need the raycasted world matrix to be represented in local space (of the 
                // interaction origin) we multiply the inverse of the interaction origin matrix by the raycasted object matrix
                // think of multiplying by the inverse as getting the offset between the origin matrix and the raycasted object matrix 
                // (e.g. the 'net matrix;, which is the local matrix of the raycasted obj)
                initialLocalMatrix: originWorldMatrix.invert().multiply(raycastedObjWorldMatrix)
            };
        }
        // if key was pressed and we are holding something
        else if (
            this.interactionControlToggled &&
            this.activeInteraction !== null
        ) {
            // get the interacted obj
            const interactedObj: THREE.Object3D = this.activeInteraction.intersection.object;
            // resume the physics body associated with this obj
            this.threeToJolt.resumePhysicsForThreeObj(interactedObj);

            // set the active interaction var to null (essentially dropping the object)
            this.activeInteraction = null;
        }

        // in every update frame, always toggle off the interaction control toggle
        this.interactionControlToggled = false;
    }

    // updates the active interaction obj (if there is any)
    protected updateActiveInteraction(): void {
        if (this.activeInteraction === null)
            return;

        // destructure the intersection obj and the initial local matrix from the active interaction obj
        const {intersection, initialLocalMatrix} = this.activeInteraction;

        // get the interacted obj from the intersection
        const interactedObj: THREE.Object3D = intersection.object;

        // get the world matrix of the origin (it is default in world space since we areon't parenting anything currently, every item currently 
        // has the scene as their parent) of the interaction origin
        const originWorldMatrix: THREE.Matrix4 = this.interactionOrigin.matrix.clone();
        // the resultant matrix is = current interaction origin transform matrix x local transformation matrix during time of pickup
        // (read right to left)
        const resultantMatrix: THREE.Matrix4 = originWorldMatrix.multiply(initialLocalMatrix);
        
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

    // updates the styling and positioning of the crosshair sprite
    private updateCrosshair(raycastResults: THREE.Intersection[]): void {
        if (this.interactionOrigin === null)
            return;

        if (this.crosshair === null) {
            console.warn("Cross hair sprite has not been initialized");
            return;
        }

        // update the styling of the crosshair here ...
        if (raycastResults.length > 0 && this.activeInteraction === null) 
            this.crosshair.material.opacity = 0.7;
        else 
            this.crosshair.material.opacity = 1;

        // update the positioning of the crosshair here...

        // get the quaternion rotation of the interaction origin
        const originQuatRot: THREE.Quaternion = this.interactionOrigin.quaternion.clone();
        // apply the rotation to the forward vector (technically this is the opposite direction of forward for all objects, however, this
        // faces the direction of where the camera faces so we'll keep it like this for consistency)
        const originForward: THREE.Vector3 = new THREE.Vector3(0, 0, -1).applyQuaternion(originQuatRot);
        // get the origin position
        const originPos: THREE.Vector3 = this.interactionOrigin.position.clone();

        // set the position as the origin's position + the origin forward * crosshair dist
        this.crosshair.position.copy(
            originPos.add(
                originForward.multiplyScalar(this.crosshairDist)
            )
        );
    }
}