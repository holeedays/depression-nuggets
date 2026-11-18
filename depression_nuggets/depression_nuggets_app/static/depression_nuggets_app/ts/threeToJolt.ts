import * as THREE from "three";
import initJolt from "jolt-physics";
import JOLT = initJolt;

import { Physics, Jolt, getJoltVec3, getJoltRVec3, getJoltQuat, getThreeVec3, getThreeQuat } from "./physics.ts"

export class ThreeToJolt {
    private physics: Physics;

    public threeToJoltBodyHashMap: Map<THREE.Object3D,{body: JOLT.Body, isPaused: boolean}> = new Map();

    constructor(timeDelta: {current: number}) {
        this.physics = new Physics(timeDelta);
    }

    // init physics and related things that need to be initialized
    public async init(): Promise<void> {
        // init the physics obj
        await this.physics.init();
    }

    // creates a cube mesh and its corresponding physics body (if enabled) and returns the cube mesh
    public createCube(
        dimensions: {
            width: number, 
            height: number, 
            depth: number, 
        } = {width: 1, height: 1, depth: 1},
        materialSpecs: {
            color: string | number 
        } = {color: 0xff00ff},
        transform: {
            position: THREE.Vector3,
            rotation: THREE.Quaternion 
        } = {position: new THREE.Vector3(), rotation: new THREE.Quaternion()},
        physics: {
            motionType: number, layer: number, mass: number, restitution: number 
        } | null = null
    ): THREE.Mesh {
        // destructure the properties from the objects
        const {width, height, depth} = dimensions;
        const {color} = materialSpecs;
        const {position, rotation} = transform;

        // set the geometry of the primitive
        const boxGeometry: THREE.BoxGeometry = new THREE.BoxGeometry(width, height, depth);
        // set the color
        const material: THREE.Material = new THREE.MeshBasicMaterial({color: color});
        // create the mesh 
        const cube: THREE.Mesh = new THREE.Mesh(boxGeometry, material);
        // set the position
        cube.position.set(position.x, position.y, position.z);
        // set the rotation
        cube.setRotationFromQuaternion(rotation);

        // if physics are enabled, set the settings for it
        if (physics !== null) {
            // destructure the needed properties from the physics obj
            const {motionType, layer, mass, restitution} = physics;

            // creates the cube physics body
            const cubePhysicsBody: JOLT.Body | null = this.physics.createCubePhysicsBody(
                getJoltRVec3(position),
                getJoltQuat(rotation),
                getJoltVec3(
                    new THREE.Vector3(width/2, height/2, depth/2)
                ),
                motionType,
                layer,
                mass,
                restitution
            ); 

            if (cubePhysicsBody !== null) {
                // add the physics body to the simulation
                this.physics.addPhysicsBody(cubePhysicsBody);
                // and set the hash map
                this.threeToJoltBodyHashMap.set(cube, {body: cubePhysicsBody, isPaused: false});
            }   
        }

        return cube;
    }

    // updates three objs and their corresponding physics objs
    // run this in the render loop
    public update(): void {
        // updates the jolt physics bodies as well as the corresponding three js mesh
        // we have to set the value as an arrow function because it's lexically scoped compared to standard functions...
        // essentially we lose reference to the 'this' keyword if we pass this function into a callback
        this.physics.update(() => {
            this.threeToJoltBodyHashMap.forEach((joltBody: {body: JOLT.Body, isPaused: boolean}, threeObj: THREE.Object3D) => {
                const {body, isPaused} = joltBody;

                // only update bodies that aren't paused
                if (isPaused)
                    return;

                const bodyPos: THREE.Vector3 = getThreeVec3(
                    body.GetPosition()
                );
                const bodyRot: THREE.Quaternion = getThreeQuat(
                    body.GetRotation()
                );

                threeObj.position.copy(bodyPos);
                threeObj.quaternion.copy(bodyRot);
            });
        });
    }

    // manually updates a given three js obj and its associated jolt body by the given pos and rot 
    // there's also an option to deactivate or activate the physics after the manual update
    public updateThreeToJoltBody(
        obj: THREE.Object3D, 
        position: THREE.Vector3, 
        rotation: THREE.Quaternion, 
        activatePhysics: boolean
    ): void {
        const joltBody: {body: JOLT.Body, isPaused: boolean} | undefined = this.threeToJoltBodyHashMap.get(obj);
        if (joltBody === undefined) {
            console.warn("Physics body for the given three obj doesn't exist currently");
            return;
        }

        // update the physics body
        this.physics.overridePhysicsBody(
            joltBody.body, 
            getJoltRVec3(position), 
            getJoltQuat(rotation),
            activatePhysics 
        );

        // update the three js obj
        obj.position.copy(position);
        obj.quaternion.copy(rotation);
    }

     // pause physics for the given three obj (if it has a physics body)
    public pausePhysicsForThreeObj(obj: THREE.Object3D): void {
        const joltBody: {body: JOLT.Body, isPaused: boolean} | undefined = this.threeToJoltBodyHashMap.get(obj);
        if (joltBody === undefined) {
            console.warn("Physics body for the given three obj doesn't exist currently");
            return;
        }

        // pause the physics body
        this.physics.pausePhysicsBody(joltBody.body);
        // set the isPaused boolean to true
        joltBody.isPaused = true;
    }

    // resume physics for the given three obj (if it has a physics body)
    public resumePhysicsForThreeObj(obj: THREE.Object3D): void {
        const joltBody: {body: JOLT.Body, isPaused: boolean} | undefined = this.threeToJoltBodyHashMap.get(obj);
        if (joltBody === undefined) {
            console.warn("Physics body for the given three obj doesn't exist currently");
            return;
        }

        // resume the physics body
        this.physics.resumePhysicsBody(joltBody.body);
        // set the isPaused boolean to false
        joltBody.isPaused = false;
    }
}