import * as THREE from "three";
import { ThreeToJolt } from "./threeToJolt.ts";

// serves as an interface implementation for interaction controller classes
export abstract class InteractionControllerBase {
    protected threeToJolt: ThreeToJolt;
    protected interactableSceneObjs: THREE.Object3D[];

    protected raycastNear: number;
    protected raycastFar: number;

    constructor(
        threeToJolt: ThreeToJolt,
        sceneObjs: THREE.Object3D[],

        raycastNear: number = 0,
        raycastFar: number = Number.POSITIVE_INFINITY,
    ) {
        // references
        this.threeToJolt = threeToJolt;
        this.interactableSceneObjs = sceneObjs;

        // params
        this.raycastNear = raycastNear;
        this.raycastFar = raycastFar;
    }

    /*
        abstract classes don't allow private as the private access modifier would prevent subclasses from 
        interacting with it; only protected (private for all classes that extend/related to this) and public are allowed
        
        make sure to match the signatures with this interface class and the child classes that extend from this
    */

    // init methods

    public abstract init(): void;
    // ...args: any[] flag allows child classes to put in any params for this fn
    protected abstract initInteractionControls(...args: any[]): void;

    // update methods

    public abstract update(): void;
    protected abstract updateRaycasts(): THREE.Intersection[] | [THREE.Intersection[], THREE.Intersection[]];
    protected abstract updateInteractionLogic(
        raycastResults: THREE.Intersection[] | [THREE.Intersection[], THREE.Intersection[]]
    ): void;
    protected abstract updateActiveInteraction(...args: any[]): void;
}