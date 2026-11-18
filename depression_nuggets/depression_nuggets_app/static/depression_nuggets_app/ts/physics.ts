import * as THREE from "three";

// Jolt is the root namespace
import initJolt from "jolt-physics";
import JOLT = initJolt;

// exclamation mark signals to the compiler this value will be initialized before it is accessed
export let Jolt!: typeof initJolt;

// NOTES FOR MESSING WITH QUATERNIONS

//if you want to find the delta between two quaternions you multiply by the inverse
//quaternion error = quaternion.current * Quaternion.Inverse(target);
//when multiplying quaternions in world space it's always world first, local last
//so sometimes transform.rotation *= worldRotationError
// transform.rotation = worldRotationError * transform.rotation

// these are used for collision detection for different items
export const LAYER: {
    NON_MOVING: Readonly<number>,
    MOVING: Readonly<number>,
    NUM_OBJ_LAYERS: Readonly<number>
} = {
    NON_MOVING: Object.freeze(0),
    MOVING: Object.freeze(1),
    NUM_OBJ_LAYERS: Object.freeze(2)
}

// wrappers to convert jolt vectors/quats to three vectors/quats and vice versa
export function getThreeVec3(joltVec3: JOLT.Vec3 | JOLT.RVec3): THREE.Vector3 {
    return new THREE.Vector3(joltVec3.GetX(), joltVec3.GetY(), joltVec3.GetZ());
}
export function getJoltVec3(threeVec3: THREE.Vector3): JOLT.Vec3 {
    return new Jolt.Vec3(threeVec3.x, threeVec3.y, threeVec3.z);
}
// RVec3's in jolt represent 64 bit ints
export function getJoltRVec3(threeVec3: THREE.Vector3): JOLT.RVec3 {
    return new Jolt.RVec3(threeVec3.x, threeVec3.y, threeVec3.z);
}
export function getThreeQuat(joltQuat: JOLT.Quat): THREE.Quaternion {
    return new THREE.Quaternion(joltQuat.GetX(), joltQuat.GetY(), joltQuat.GetZ(), joltQuat.GetW());
}
export function getJoltQuat(threeQuat: THREE.Quaternion): JOLT.Quat {
    return new Jolt.Quat(threeQuat.x, threeQuat.y, threeQuat.z, threeQuat.w);
}

// master class that enables the physics
export class Physics {
    private timeDelta: {current: number};

    public jolt: JOLT.JoltInterface | null = null;
    public physicsSystem: JOLT.PhysicsSystem | null = null;
    public bodyInterface: JOLT.BodyInterface | null = null;
    public settings: JOLT.JoltSettings | null = null;

    constructor (timeDelta: {current: number}) {
        this.timeDelta = timeDelta;
    }

    public async init(): Promise<void> {
        Jolt = await initJolt();
        this.initPhysics();
    }

    // inits the physics controller
    private initPhysics(): void {
        // Initialize Jolt
        this.settings = new Jolt.JoltSettings();
        // Limit the number of worker threads to 3 (for a total of 4 threads working on the simulation). Note that this
        // value will always be clamped against the number of CPUs in the system - 1
        this.settings.mMaxWorkerThreads = 3; 
        const assertFailed: JOLT.AssertFailedHandlerJS = new Jolt.AssertFailedHandlerJS();
        assertFailed.OnAssertFailed = (expression: number, message: number, file: number, line: number) => {
            console.error(
                `Assert failed: (${expression}) ${message} at ${file}:${line}`
            );
        };
        this.settings.mAssertFailedHandler = assertFailed;

        this.initCollisionFiltering(this.settings);
        this.jolt = new Jolt.JoltInterface(this.settings);
        Jolt.destroy(this.settings);
        this.physicsSystem = this.jolt.GetPhysicsSystem();
        this.bodyInterface = this.physicsSystem.GetBodyInterface();
    }

    // basically just determines what can collide with what based on their layer
    private initCollisionFiltering(settings: JOLT.JoltSettings) {
        // Layer that objects can be in, determines which other objects it can collide with
        // Typically you at least want to have 1 layer for moving bodies and 1 layer for static bodies, but you can have more
        // layers if you want. E.g. you could have a layer for high detail collision (which is not used by the physics simulation
        // but only if you do collision testing).
        let objectFilter: JOLT.ObjectLayerPairFilterTable = new Jolt.ObjectLayerPairFilterTable(LAYER.NUM_OBJ_LAYERS);
        objectFilter.EnableCollision(LAYER.NON_MOVING, LAYER.MOVING);
        objectFilter.EnableCollision(LAYER.MOVING, LAYER.MOVING);

        // Each broadphase layer results in a separate bounding volume tree in the broad phase. You at least want to have
        // a layer for non-moving and moving objects to avoid having to update a tree full of static objects every frame.
        // You can have a 1-on-1 mapping between object layers and broadphase layers (like in this case) but if you have
        // many object layers you'll be creating many broad phase trees, which is not efficient.
        const BP_LAYER_NON_MOVING: JOLT.BroadPhaseLayer = new Jolt.BroadPhaseLayer(0);
        const BP_LAYER_MOVING: JOLT.BroadPhaseLayer = new Jolt.BroadPhaseLayer(1);
        const NUM_BROAD_PHASE_LAYERS: number = 2;
        let bpInterface: JOLT.BroadPhaseLayerInterfaceTable = new Jolt.BroadPhaseLayerInterfaceTable(LAYER.NUM_OBJ_LAYERS, NUM_BROAD_PHASE_LAYERS);
        bpInterface.MapObjectToBroadPhaseLayer(LAYER.NON_MOVING, BP_LAYER_NON_MOVING);
        bpInterface.MapObjectToBroadPhaseLayer(LAYER.MOVING, BP_LAYER_MOVING);  

        settings.mObjectLayerPairFilter = objectFilter;
        settings.mBroadPhaseLayerInterface = bpInterface;
        settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(
            settings.mBroadPhaseLayerInterface, 
            NUM_BROAD_PHASE_LAYERS, 
            settings.mObjectLayerPairFilter, 
            LAYER.NUM_OBJ_LAYERS
        );
    }

    // umbrella function to run in the render loop
    public update(onPhysicsUpdateCallback: () => void): void {
        // updates the physics scene
        this.stepPhysicsScene();
        // update the individual children within the scene
        onPhysicsUpdateCallback();
    }

    // updates the jolt physics scene 
    private stepPhysicsScene(): void {
        // When running below 55 Hz, do 2 steps instead of 1
        const numSteps: number = this.timeDelta.current > 1.0 / 55.0 ? 2 : 1;

        if (this.jolt === null)
            return;

        // Step the physics world
        this.jolt.Step(this.timeDelta.current, numSteps);
    }

    // adds the body to the physics scene
    public addPhysicsBody(body: JOLT.Body): void {
        if (this.bodyInterface === null) {
            console.warn("Body interface hasn't been initialized");
            return;
        }

        this.bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate);
    }

    // sets a physics body to static, preventing any physics to it (though it still is in the simulation)
    public pausePhysicsBody(body: JOLT.Body): void {
        if (this.bodyInterface === null) {
            console.warn("Body interface hasn't been initialized");
            return;
        }

        this.bodyInterface.SetMotionType(body.GetID(), Jolt.EMotionType_Static, JOLT.EActivation_DontActivate);
    }

    // sets te physics body back to dynamic, allowing the physics body to behave like any dynamic object
    public resumePhysicsBody(body: JOLT.Body): void {
        if (this.bodyInterface === null) {
            console.warn("Body interface hasn't been initialized");
            return;
        }

        this.bodyInterface.SetMotionType(body.GetID(), Jolt.EMotionType_Dynamic, JOLT.EActivation_Activate);
    }

    // removes the physics body from the simulation and sends it to garbage collection
    public removePhysicsBody(body: JOLT.Body): void {
        if (this.bodyInterface === null) {
            console.warn("Body interface hasn't been initialized");
            return;
        }

        this.bodyInterface.RemoveBody(body.GetID());
        JOLT.destroy(body);
    }

    // manually updates a physics body and chooses whether to activate the physics body or not
    public overridePhysicsBody(body: JOLT.Body, position: JOLT.RVec3, rotation: JOLT.Quat, activatePhysics: boolean): void {
        if (this.bodyInterface === null) {
            console.warn("Body interface hasn't been initialized");
            return;
        }

        // get the body ID
        const bodyID: JOLT.BodyID = body.GetID();
        // get the target activation based on the passed boolean
        const targetActivation: number = activatePhysics ? Jolt.EActivation_Activate : Jolt.EActivation_DontActivate;

        // set position and rotation of the body
        this.bodyInterface.SetPosition(bodyID, position, targetActivation);
        this.bodyInterface.SetRotation(bodyID, rotation, targetActivation);
    }

    // create a physics cube shape
    public createCubePhysicsBody(
        position: JOLT.RVec3, 
        rotation: JOLT.Quat,
        halfExtent: JOLT.Vec3, 
        motionType: JOLT.EMotionType, 
        layer: number,
        mass: number, 
        restitution: number
    ): JOLT.Body | null {
        if (this.bodyInterface === null) {
            console.warn("Body interface hasn't been initialized");
            return null;
        }

        let shape = new Jolt.BoxShape(halfExtent, 0.05, undefined);
        let creationSettings = new Jolt.BodyCreationSettings(shape, position, rotation, motionType, layer);
        creationSettings.mMassPropertiesOverride.mMass = mass;
        creationSettings.mRestitution = restitution;
        let body = this.bodyInterface.CreateBody(creationSettings);
        Jolt.destroy(creationSettings);

        return body;
    }

    // creates a physics sphere shape
    public createSpherePhysicsBody(
        position: JOLT.RVec3, 
        radius: number, 
        motionType: JOLT.EMotionType, 
        layer: number
    ): JOLT.Body | null {
        if (this.bodyInterface === null) {
            console.warn("Body interface hasn't been initialized");
            return null;
        }

        let shape: JOLT.SphereShape = new Jolt.SphereShape(radius, undefined);
        let creationSettings = new Jolt.BodyCreationSettings(
            shape, position, Jolt.Quat.prototype.sIdentity(), motionType, layer
        );
        let body: JOLT.Body = this.bodyInterface.CreateBody(creationSettings);
        Jolt.destroy(creationSettings);

        return body;
    }

    // creates a three mesh for a given shape
    public createMeshForShape(shape: JOLT.Shape): THREE.BufferGeometry {
        // Get triangle data
        let scale: JOLT.Vec3 = new Jolt.Vec3(1, 1, 1);
        let triContext: JOLT.ShapeGetTriangles = new Jolt.ShapeGetTriangles(
            shape, 
            Jolt.AABox.prototype.sBiggest(), 
            shape.GetCenterOfMass(), 
            Jolt.Quat.prototype.sIdentity(), 
            scale
        );
        // remember garbage collection is not automatically done with jolt, you have to manually destroy reference types
        Jolt.destroy(scale);

        // Get a view on the triangle data (does not make a copy)
        let vertices: Float32Array = new Float32Array(
            Jolt.HEAPF32.buffer, 
            triContext.GetVerticesData(), 
            triContext.GetVerticesSize() / Float32Array.BYTES_PER_ELEMENT
        );

        // Now move the triangle data to a buffer and clone it so that we can free the memory from the C++ heap (which could be limited in size)
        let buffer: THREE.BufferAttribute = new THREE.BufferAttribute(vertices, 3).clone();
        Jolt.destroy(triContext);

        // Create a three mesh
        let geometry: THREE.BufferGeometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', buffer);
        geometry.computeVertexNormals();

        return geometry;
    }
}
