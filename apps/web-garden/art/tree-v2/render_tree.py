"""Optional studio inspection of an exported GLB; never edits/saves the source.

Blender --background --factory-startup --threads 4 --python render_tree.py --
    path/to/tree.glb 3 artifacts/tree-stage-3.png
The 2026-10-31 user instruction permits renders and visual inspection.
"""
import bpy, sys
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
source, stage, output=args[0], int(args[1]), args[2]
assert stage in range(4), 'Stage must be 0, 1, 2 or 3'
Path(output).parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
for i in range(4):
    root=bpy.data.objects.get(f'tree-stage-{i}')
    if i != stage:
        for obj in [root]+list(root.children_recursive): obj.hide_render=True
# Blender glTF import produces native Z-up.
def aim(obj, p): obj.rotation_euler=(Vector(p)-obj.location).to_track_quat('-Z','Y').to_euler()
target=(0,0,1 if stage==0 else 1.8)
bpy.ops.object.camera_add(location=(5,-8,5.7)); cam=bpy.context.object; aim(cam,target)
cam.data.type='ORTHO'; cam.data.ortho_scale=2.9 if stage==0 else 4.9
bpy.context.scene.camera=cam
for name, pos, energy, size, color in [('Key',(-3,-4,7),700,5,(1,.91,.80)),('Fill',(4,-1,4),180,4,(.78,.87,1)),('Rim',(1,3,5),400,3,(1,.98,.86))]:
    bpy.ops.object.light_add(type='AREA',location=pos); l=bpy.context.object;l.name=name;l.data.energy=energy;l.data.shape='DISK';l.data.size=size;l.data.color=color;aim(l,(0,0,1.5))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02)); floor=bpy.context.object
mat=bpy.data.materials.new('Preview floor');mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.70,.74,.64,1);mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9;floor.data.materials.append(mat)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=int(args[3]) if len(args)>3 else 96;scene.cycles.use_denoising=False
scene.world.color=(.25,.25,.25)
scene.render.resolution_x=700;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=output
bpy.ops.render.render(write_still=True)
