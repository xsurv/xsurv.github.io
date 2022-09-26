import * as THREE from './three.js';
import {Octree} from "./Octree.js";
import {Capsule} from "./Capsule.js";
let renderer,dcamera,scene,loader,env;

let lprog=0;
let assets={};
let pendingBlobs=0;
let assetsFinished=false;
let scenes={};
let scripts={};
let dmat=new THREE.MeshBasicMaterial({color:0xffffff});
let sce=meta.mainScene;
let scriptScheds=[];
let scriptdefs={};
let firstrun=true;
let keyspressed={};
let onkeypress=[];
let onkeyunpress=[];
let mobile=false;
let dfbgs;
let websocket;
let audios=[];
let gamevars={};

let touch={r:new THREE.Raycaster(),o:null,p:new THREE.Vector2(),m:false};

let exts={
	image:["gif","jpg","jpeg","jfif","png","webp","bmp","ico","tif","tiff"],
	script:["js"],
	scene:["sc"],
	audio:["mp3","ogg"]
};

function init(){
	mobile=analyseUA(String(navigator.userAgent));
	
	renderer=new THREE.WebGLRenderer({antialias:true});
	renderer.setSize(window.innerWidth,window.innerHeight);
	renderer.shadowMap.enabled=true;
	renderer.shadowMap.type=THREE.PCFSoftShadowMap;
	
	scene=new THREE.Scene();
	
	document.body.appendChild(createLoader());
	document.body.style.margin="0";
	document.body.appendChild(renderer.domElement);
	
	window.addEventListener("resize",function(){
		if(dcamera!=undefined){
			dcamera.aspect=window.innerWidth/window.innerHeight;
			dcamera.updateProjectionMatrix();
		}
		renderer.setSize(window.innerWidth,window.innerHeight);
	});
	
	window.addEventListener("keydown",function(event){
		keyspressed[event.key]=true;
		for(let i=0;i<onkeypress.length;i++){
			onkeypress[i](event.key);
		}
	});
	
	window.addEventListener("keyup",function(event){
		keyspressed[event.key]=false;
		for(let i=0;i<onkeyunpress.length;i++){
			onkeyunpress[i](event.key);
		}
	});
	
	document.body.addEventListener("mousemove",m_move);
	document.body.addEventListener("mouseup",m_up);
	document.body.addEventListener("mousedown",m_down);
	document.body.addEventListener("pointerup",m_up);
	document.body.addEventListener("pointerdown",m_down);
	
	setLoader(0);
	assetProg(0);
}
function animate(){
	requestAnimationFrame(animate);
	if(dfbgs!=undefined){
		m_upd();
	}
	if(dcamera!=undefined){
		renderer.render(scene,dcamera);
	}
	tick();
}

function allLoaded(){
	env=assets["sky.jpeg"];
	env.mapping=THREE.EquirectangularReflectionMapping;
	scene.environment=env;
	switchScene(meta.mainScene);
	tick();
	animate();
	hideLoader();
}

function analyseUA(ua){
	let mobile=false;
	mobile=(ua.includes("iPhone"))||mobile;
	mobile=(ua.includes("Android"))||mobile;
	mobile=(ua.includes("Windows Phone"))||mobile;
	mobile=(ua.includes("Nokia"))||mobile;
	mobile=(ua.includes("KFAPWI"))||mobile;
	return(mobile);
}

function createLoader(){
	loader=document.createElement("div");
	loader.style.width="100%";
	loader.style.height="100%";
	loader.style.background="rgb(20,20,20)";
	loader.style.zIndex="1000000";
	loader.style.position="fixed";
	
	let pb1=document.createElement("div");
	pb1.style.left="25%";
	pb1.style.top="calc(50% - 25px)";
	pb1.style.position="fixed";
	pb1.style.background="white";
	pb1.style.width="50%";
	pb1.style.height="50px";
	loader.appendChild(pb1);
	
	let pb2=document.createElement("div");
	pb2.style.left="25%";
	pb2.style.top="calc(50% - 25px)";
	pb2.style.position="fixed";
	pb2.style.background="green";
	pb2.style.width="25%";
	pb2.style.height="50px";
	loader.appendChild(pb2);
	
	return(loader);
}

function setLoader(progress){
	lprog=progress;
	loader.children[loader.children.length-1].style.width=String(progress/2)+"%";
}

function hideLoader(){
	loader.style.display="none";
}

function httpRequest(url,onLoad,rtp="text"){
	let req=new XMLHttpRequest();
	req.responseType=rtp;
	req.addEventListener("load",onLoad);
	req.open("GET",url);
	req.send();
}

function assetProg(i){
	httpRequest("data/"+meta.assets[i],function(){
		assets[meta.assets[i]]=translateAsset(meta.assets[i],this);
		
		setLoader(Math.round(((i+1)/meta.assets.length)*50));
		i+=1;
		if(i!=meta.assets.length){
			assetProg(i);
		}else{
			assetsFinished=true;
			if(pendingBlobs==0){
				allLoaded();
			}
		}
	},"blob");
}

function translateAsset(filename,response){
	let blob=response.response;
	let out;
	if(exts.image.includes(filename.split(".")[filename.split(".").length-1])){
		out=new THREE.Texture();
		out.image=document.createElement("img");
		out.image.src=window.URL.createObjectURL(blob);
		out.needsUpdate=true;
	}
	if(exts.script.includes(filename.split(".")[filename.split(".").length-1])){
		out="";
		pendingBlobs+=1;
		blob.text().then(function(t){
			pendingBlobs-=1;
			assets[filename]=t;
			parseScript(filename,t);
			scriptdefs[filename.substring(0,filename.length-3)]=findDefinitions(t);
			if(pendingBlobs==0){
				if(assetsFinished){
					allLoaded();
				}
			}
		});
	}
	if(exts.scene.includes(filename.split(".")[filename.split(".").length-1])){
		out="";
		pendingBlobs+=1;
		blob.text().then(function(t){
			pendingBlobs-=1;
			assets[filename]=t;
			if(pendingBlobs==0){
				if(assetsFinished){
					allLoaded();//ultra rare
				}
			}
		});
	}
	if(exts.audio.includes(filename.split(".")[filename.split(".").length-1])){
		out="";
		assets[filename]=window.URL.createObjectURL(blob);
		if(pendingBlobs==0){
			if(assetsFinished){
				allLoaded();//ultra rare
			}
		}
	}
	return(out);
}

function parseScene(scn,n){
	scenes[scn.substring(0,scn.length-3)]=objectifyJson(n,true);
	scenes[scn.substring(0,scn.length-3)].traverse(function(o){
		if(o.type=='PerspectiveCamera'){
			dcamera=o;
		}
	});
}

function objectifyJson(json,isScene=false){
	let obj;
	if(!isScene){
		let cprop={color:0xffffff,intensity:1};
		if(json.color!=undefined){
			cprop.color=new THREE.Color(json.color);
			cprop.intensity=json.intensity;
		}
		obj=createObjectFromJson(json.type,json.geo,cprop);
		if(json.material!=undefined){
			obj.material=materialifyJson(json.material);
		}
		transformvalueifyJson(json.transform,obj);
		obj.userData.tag=json.tag;
	}else{
		obj=new THREE.Object3D();
		obj.userData.tag=json.tag;
		obj.userData.background=mapifyJson(json.background);
	}	
	obj.userData.scripts=json.scripts;
	for(let i=0;i<json.children.length;i++){
		obj.add(objectifyJson(json.children[i]));
	}
	return(obj);
}

function transformvalueifyJson(json,obj){
	obj.position.set(json[0],json[1],json[2]);
	obj.rotation.set(json[3],json[4],json[5]);
	obj.scale.set(json[6],json[7],json[8]);
}

function materialifyJson(json){
	let mat;
	if(json.type=="MeshBasicMaterial"){
		mat=new THREE.MeshBasicMaterial({
			color:new THREE.Color(json.color),
			opacity:json.opacity,
			transparent:json.transparent,
			side:json.side
		});
		mat.map=mapifyJson(json.map,mat);
	}
	if(json.type=="MeshStandardMaterial"){
		mat=new THREE.MeshStandardMaterial({
			color:new THREE.Color(json.color),
			opacity:json.opacity,
			transparent:json.transparent,
			metalness:json.metalness,
			roughness:json.roughness,
			side:json.side
		});
		mat.castShadow=true;
		mat.receiveShadow=true;
		mat.map=mapifyJson(json.map,mat);
		mat.metalnessMap=mapifyJson(json.metalnessMap,mat);
		mat.roughnessMap=mapifyJson(json.roughnessMap,mat);
		mat.bumpMap=mapifyJson(json.bumpMap,mat);
		mat.normalMap=mapifyJson(json.normalMap,mat);
	}
	return(mat);
}

function mapifyJson(json,mat){
	return(assets[json]);
}

function createObjectFromJson(type="empty",geo="empty",cprop){
	let mesh;
	if(type=="object"&&geo=="plane"){
		mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),dmat.clone());
		mesh.userData.tag="Plane";
		mesh.userData.type="object";
		mesh.userData.scripts=[];
		mesh.userData.geo="plane";
	}
	if(type=="object"&&geo=="box"){
		mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),dmat.clone());
		mesh.userData.tag="Box";
		mesh.userData.type="object";
		mesh.userData.scripts=[];
		mesh.userData.geo="box";
	}
	if(type=="object"&&geo=="circle"){
		mesh=new THREE.Mesh(new THREE.CircleGeometry(1,32,0,Math.PI*2),dmat.clone());
		mesh.userData.tag="Circle";
		mesh.userData.type="object";
		mesh.userData.scripts=[];
		mesh.userData.geo="circle";
	}
	if(type=="object"&&geo=="sphere"){
		mesh=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),dmat.clone());
		mesh.userData.tag="Sphere";
		mesh.userData.type="object";
		mesh.userData.scripts=[];
		mesh.userData.geo="sphere";
	}
	if(type=="object"&&geo=="pyramid"){
		mesh=new THREE.Mesh(new THREE.ConeGeometry(1,1,3),dmat.clone());
		mesh.userData.tag="Pyramid";
		mesh.userData.type="object";
		mesh.userData.scripts=[];
		mesh.userData.geo="pyramid";
	}
	if(type=="object"&&geo=="torus"){
		mesh=new THREE.Mesh(new THREE.TorusGeometry(1,0.4,20,32),dmat.clone());
		mesh.userData.tag="Torus";
		mesh.userData.type="object";
		mesh.userData.scripts=[];
		mesh.userData.geo="torus";
	}
	if(type=="object"&&geo=="bean"){
		mesh=new THREE.Mesh(new THREE.CapsuleGeometry(1,1,8,16),dmat.clone());
		mesh.userData.tag="Bean";
		mesh.userData.type="object";
		mesh.userData.scripts=[];
		mesh.userData.geo="bean";
	}
	if(type=="object"&&geo=="cylinder"){
		mesh=new THREE.Mesh(new THREE.CylinderGeometry(1,1,2,20),dmat.clone());
		mesh.userData.tag="Cylinder";
		mesh.userData.type="object";
		mesh.userData.scripts=[];
		mesh.userData.geo="cylinder";
	}
	if(type=="object"&&geo=="icosphere"){
		mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(1,4),dmat.clone());
		mesh.userData.tag="Icosphere";
		mesh.userData.type="object";
		mesh.userData.scripts=[];
		mesh.userData.geo="icosphere";
	}
	if(type=="light"&&geo=="light"){
		mesh=new THREE.PointLight(cprop.color,cprop.intensity,20);
		mesh.userData.tag="Light";
		mesh.userData.type="light";
		mesh.userData.scripts=[];
		mesh.userData.geo="light";
		mesh.castShadow=true;
		setupShadow(mesh);
	}
	if(type=="light"&&geo=="hemi"){
		mesh=new THREE.HemisphereLight(cprop.color,0x333333,cprop.intensity);
		mesh.userData.tag="Sun";
		mesh.userData.type="light";
		mesh.userData.scripts=[];
		mesh.userData.geo="hemi";
	}
	if(type=="empty"&&geo=="empty"){
		mesh=new THREE.Object3D();
		mesh.userData.tag="Empty";
		mesh.userData.type="empty";
		mesh.userData.scripts=[];
		mesh.userData.geo="empty";
	}
	if(type=="camera"&&geo=="camera"){
		mesh=new THREE.PerspectiveCamera(80,window.innerWidth/window.innerHeight,0.1,10000);
		mesh.userData.tag="Camera";
		mesh.userData.type="camera";
		mesh.userData.scripts=[];
		mesh.userData.geo="camera";
	}
	return(mesh);
}

function parseScript(fn,c){
	scripts[fn.substring(0,fn.length-3)]=c;
}

function switchScene(name){
	parseScene(name+".sc",JSON.parse(assets[name+".sc"]));
	if(scenes[sce].parent!=null){
		scenes[sce].removeFromParent();
	}
	scene.add(scenes[name]);
	sce=name;
	scriptScheds=ejectScripts(scenes[sce]);
	dfbgs=scenes[sce];
	firstrun=true;
	gamevars={};
	keyspressed={};
	gamevars={};
	updateSceneMeta();
}

function notNull(v){
	return((v!=null)&&(v!=undefined));
}

function updateSceneMeta(){
	if(notNull(scenes[sce].userData.background)){
		scene.background=scenes[sce].userData.background;
		scene.background.mapping=THREE.EquirectangularReflectionMapping;
	}else{
		scene.background=null;
	}
}

function ejectScripts(scene){
	let out=[];
	scene.traverse(function(o){
		if(o.userData.scripts!=undefined){
			for(let i=0;i<o.userData.scripts.length;i++){
				out.push([scripts[o.userData.scripts[i]],o,scriptdefs[o.userData.scripts[i]]]);
			}
		}
	});
	return(out);
}

function tick(){
	for(let i=0;i<scriptScheds.length;i++){
		runScript(scriptScheds[i][0],scriptScheds[i][2],scriptScheds[i][1]);
	}
	if(firstrun){
		firstrun=false;
	}
}

function runScript(code,defs,scope){
	eval(code);
}

function findDefinitions(code){
	let defs=code.split("/*DEFINE ");
	let defs2=[];
	try{
		for(let i=1;i<defs.length;i++){
			try{
				let def=defs[i].split("*/");
				defs2.push(def[0]);
			}catch(err){}
		}
	}catch(err){}
	return(defs2);
}

function m_move(e){
	touch.p.set((e.clientX/renderer.domElement.clientWidth)*2-1,-(e.clientY/renderer.domElement.clientHeight)*2+1);
}

function m_up(e){
	touch.m=false;
}

function m_down(e){
	touch.m=true;
}

function m_upd(){
	touch.r.setFromCamera(touch.p,dcamera);
	let intersects=touch.r.intersectObject(dfbgs);
	if(intersects.length>0){
		touch.o=intersects[0].object;
	}else{
		touch.o=null;
	}
}

//API

function vecOperation(v1,v2,op){
	let base;
	if(v1.z!=undefined){
		base=new THREE.Vector3();
		base.copy(v1);
	}else{
		base=new THREE.Vector2();
		base.copy(v1);
	}
	if(op=="add"){
		base.add(v2);
	}
	if(op=="sub"){
		base.sub(v2);
	}
	if(op=="mul"){
		base.multiply(v2);
	}
	if(op=="div"){
		base.divide(v2);
	}
	return(base);
}

function findObjectByTag(tag){
	let obj;
	scenes[sce].traverse(function(o){
		if(o.userData.tag==tag){
			obj=o;
		}
	});
	return(obj);
}

function smartClone(o){
	let obj=o.clone();
	registerScripts(obj);
	return(obj);
}

function registerScripts(o){
	if(o.userData.scripts!=undefined){
		for(let i=0;i<o.userData.scripts.length;i++){
			scriptScheds.push([scripts[o.userData.scripts[i]],o,scriptdefs[o.userData.scripts[i]]]);
		}
	}
}

function addCapsuleTo(h,r,o){
	o.userData.capsule=new Capsule(new THREE.Vector3(0,r,0),new THREE.Vector3(0,h,0),r);
	o.userData.capsuleData={h:h,r:r};
}

function createOctree(o){
	o.userData.octree=new Octree();
	o.userData.octree.fromGraphNode(o);
}

function checkCollision_CO(capsule,octree,o1,o2,collide){
	updateCapsule(o1);
	if(octree!=undefined&&capsule!=undefined){
		let coll=false;
		let result=octree.capsuleIntersect(capsule);
		if(result){
			coll=true;
			if(collide){
				o1.position.add(result.normal.multiplyScalar(result.depth));
			}
		}
		return(coll);
	}
}

function updateCapsule(scope){
	if(scope.userData.capsule!=undefined){
		scope.userData.capsule.start.copy(scope.position);
		scope.userData.capsule.end.copy(scope.position);
		scope.userData.capsule.start.y+=scope.userData.capsuleData.r-(scope.userData.capsuleData.h/2);
		scope.userData.capsule.end.y+=scope.userData.capsuleData.h/2;
	}
}

function isKeyPressed(key){
	return(keyspressed[key]==true);
}

function onKeyPress(on){
	onkeypress.push(on);
}

function onKeyUnpress(on){
	onkeyunpress.push(on);
}

function getPressedKeys(){
	let out=[];
	for(let key in keyspressed){
		if(keyspressed[key]==true){
			out.push(key);
		}
	}
	return(out);
}

function randomRange(min,max){
	return(Math.floor(Math.random()*(max-min+1)+min));
}

function playSound(a){
	if(!Object.keys(audios).includes(a)){
		audios[a]=new Howl({src:[assets[a]],format:["mp3","ogg"]});
	}
	audios[a].play();
}

function setupShadow(dir){
	dir.shadow.camera.left=-400;
	dir.shadow.camera.right=400;
	dir.shadow.camera.top=400;
	dir.shadow.camera.bottom=-400;
	dir.shadow.mapSize.x=1024;
	dir.shadow.mapSize.y=1024;
	dir.shadow.bias=-0.005;
	dir.castShadow=true;
}

function consolelog(text){
	console.log(text);
}

document.addEventListener("DOMContentLoaded",init);

