export function clamp(value: number, min: number, max: number) {
    return Math.max(Math.min(value, max), min);
}

export function toRad(deg: number): number {
    return deg * Math.PI / 180;
}

export function toDeg(rad: number): number {
    return rad * 180 / Math.PI;
}