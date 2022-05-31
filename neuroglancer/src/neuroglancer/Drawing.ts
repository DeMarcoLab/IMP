import * as THREE from 'three';

export class Drawing {

    private cube: THREE.Mesh;
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    constructor(canvas: HTMLCanvasElement) {

        console.log("Drawing");
        this.renderer = new THREE.WebGLRenderer({ canvas: canvas });
        this.scene = new THREE.Scene(); // Create a Three.js scene object.
        this.camera = new THREE.Camera();
        //document.body.appendChild(renderer.domElement); // Append the WebGL viewport to the DOM.
       
        var geometry = new THREE.BoxGeometry(20, 20, 20); // Create a 20 by 20 by 20 cube.
        var material = new THREE.MeshBasicMaterial({ color: 0x0000FF }); // Skin the cube with 100% blue.
        this.cube = new THREE.Mesh(geometry, material);
        this.scene.add(this.cube); // Add the cube at (0, 0, 0).
        console.log(this.camera)
        this.camera.lookAt(0)
        this.render();
    }
    render() {
        //this.cube.rotation.x += 0.01; // Rotate the sphere by a small amount about the x- and y-axes.
        //this.cube.rotation.y += 0.01;

        this.renderer.render(this.scene,this.camera); // Each time we change the position of the cube object, we must re-render it.
       // requestAnimationFrame(this.render); // Call the render() function up to 60 times per second (i.e., up to 60 animation frames per second).
    };


}