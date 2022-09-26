if(isKeyPressed("s")){
    var vect=new THREE.Vector3();
    scope.getWorldPosition(vect);
    dcamera.position.copy(vect);
}
