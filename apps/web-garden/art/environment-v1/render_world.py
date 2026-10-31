"""Offline Cycles inspection of an exported actual Three scene; not WebGL evidence."""
import argparse,sys,math
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',required=True);p.add_argument('--subject',default='korean');p.add_argument('--stage',type=int,default=3);p.add_argument('--width',type=int,default=720);p.add_argument('--height',type=int,default=600);p.add_argument('--samples',type=int,default=24);p.add_argument('--side-light',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(Path(a.source).resolve()))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=a.samples;s.cycles.use_denoising=False;s.render.threads_mode='FIXED';s.render.threads=4
s.render.resolution_x=a.width;s.render.resolution_y=a.height;s.render.resolution_percentage=100
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.72,.79,.75,1);s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.55
mat=bpy.data.materials.new('Review tabletop');mat.diffuse_color=(.24,.31,.27,1);bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.78));bpy.context.object.data.materials.append(mat)
def aim(o,point):o.rotation_euler=(Vector(point)-o.location).to_track_quat('-Z','Y').to_euler()
for name,pos,energy,size,col in [('key',(-5,-7,12) if not a.side_light else (8,-2,7),1800,7,(1,.88,.72)),('fill',(7,-3,6),650,9,(.72,.86,1)),('rim',(0,7,10),1600,6,(1,.96,.82))]:
 d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.shape='DISK';d.size=size;d.color=col;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=pos;aim(o,(0,0,1))
d=bpy.data.cameras.new('Review camera');o=bpy.data.objects.new('Review camera',d);s.collection.objects.link(o)
target=1.8 if a.subject=='english' else ([.95,1.3,1.6,1.6][a.stage] if a.subject=='korean' else 1.05+a.stage*.12)
# Same default orbit azimuth/polar as runtime, wider overview to inspect surroundings.
r=15.1;phi=1.2 if a.subject=='english' else 1.14;o.location=(r*math.sin(phi)*math.sin(.24),-r*math.sin(phi)*math.cos(.24)-.25,r*math.cos(phi)+target);aim(o,(0,-.25,target));d.type='PERSP';d.lens=44;s.camera=o
s.view_settings.view_transform='AgX';s.render.image_settings.file_format='PNG';Path(a.output).parent.mkdir(parents=True,exist_ok=True);s.render.filepath=str(Path(a.output).resolve());bpy.ops.render.render(write_still=True)
