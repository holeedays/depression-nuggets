import * as THREE from "three";

export type CameraType = "orthographic" | "perspective";

export function createCamera(
    camType: CameraType,
    fov: number,
    aspectRatio: number,
    nearClip: number,
    farClip: number
): THREE.OrthographicCamera | THREE.PerspectiveCamera {
    switch(camType) {
        case "orthographic":
            return new THREE.OrthographicCamera(fov, aspectRatio, nearClip, farClip);
        case "perspective":
            return new THREE.PerspectiveCamera(fov, aspectRatio, nearClip, farClip);
    }
}