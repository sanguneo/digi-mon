"""Actual exported-GLB studio studies, not runtime rendering or generated artwork."""
import argparse,json,sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
p=argparse.ArgumentParser();p.add_argument('--asset',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--part',default='all');p.add_argument('--size',type=int,default=440);p.add_argument('--samples',type=int,default=40);o=p.parse_args(args)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(o.asset.resolve()))
parts={x.name:x for x in bpy.data.objects if x.type=='MESH'}
bounds=json.loads((HERE/'baseline-bounds.json').read_text())['bounds']
def P(v):return Vector((v[0],-v[2],v[1]))
def aim(obj,target):obj.rotation_euler=(P(target)-obj.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=o.samples;scene.cycles.use_denoising=False
scene.render.resolution_x=o.size;scene.render.resolution_y=round(o.size*.90);scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene.world=bpy.data.worlds.new('review-world');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.22,.24,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
camera=bpy.data.objects.new('review-camera',bpy.data.cameras.new('review-camera'));bpy.context.collection.objects.link(camera);camera.data.type='ORTHO';scene.camera=camera
lights=[]
for name,delta,energy,size,color in [('key',(-2,4,5),440,4,(1,.91,.80)),('rim',(2,3,-3),500,3,(.65,.84,1)),('fill',(4,1,4),120,3,(1,.96,.89))]:
 data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size;data.color=color
 obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);lights.append((obj,delta))
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='review-ground';mat=bpy.data.materials.new('review-ground');mat.use_nodes=True;bs=mat.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=(.14,.22,.23,1);bs.inputs['Roughness'].default_value=.9;floor.data.materials.append(mat)
for name in bounds if o.part=='all' else [o.part]:
 for n,obj in parts.items():obj.hide_render=n!=name
 b=bounds[name];center=b['center'];size=b['size'];camera.location=P((center[0]+2.2,center[1]+1.25,center[2]+5.8));aim(camera,center);camera.data.ortho_scale=max(size[0],size[1]/.90,size[2])*1.48
 floor.location.z=b['min'][1]-.012
 for obj,delta in lights:obj.location=P(tuple(center[i]+delta[i] for i in range(3)));aim(obj,center)
 path=o.output/(name+'.png') if o.part=='all' else o.output;path.parent.mkdir(parents=True,exist_ok=True);scene.render.filepath=str(path.resolve());bpy.ops.render.render(write_still=True)
