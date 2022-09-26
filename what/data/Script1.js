if(firstrun){  dcamera=scope;dcamera.aspect=window.innerWidth/window.innerHeight;dcamera.updateProjectionMatrix();}

if(isKeyPressed("a")){  scope.rotation.y=scope.rotation.y+0.1;
}
if(isKeyPressed("d")){  scope.rotation.y=scope.rotation.y+-0.1;
}
