"""Optional authoring-only studio render. No camera/light is exported to the game.

blender --background --threads 4 art/fish-v3/fish-v3.blend --python render_fish_v3.py -- --output /tmp/fish-v3.png
"""
import argparse
import sys
from pathlib import Path
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=Path('/tmp/fish-v3.png'))
parser.add_argument('--lighting', choices=('studio', 'raking'), default='studio')
parser.add_argument('--stage', type=int, choices=range(4), default=0)
parser.add_argument('--asset', type=Path, help='Optional GLB to compare under the identical studio lighting')
parser.add_argument('--tail-angle', type=float, default=0)
parser.add_argument('--fin-angle', type=float, default=-.6)
parser.add_argument('--mouth-scale', type=float, default=1)
parser.add_argument('--samples', type=int, default=96)
parser.add_argument('--size', type=int, default=1100)
parser.add_argument('--view', choices=('side', 'three-quarter'), default='three-quarter')
options = parser.parse_args(args)
if options.asset:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(options.asset.resolve()))
def P(p):
    return Vector((p[0], -p[2], p[1]))
def aim(obj, target):
    obj.rotation_euler = (P(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()
def area(name, position, power, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size, data.color = power, 'DISK', size, color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = P(position)
    aim(obj, (-.2, .1, 0))

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = options.samples
scene.cycles.use_denoising = False
scene.render.resolution_x, scene.render.resolution_y = options.size, round(options.size * 9 / 11)
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new('studio-world')
scene.world.use_nodes = True
background = scene.world.node_tree.nodes.get('Background')
background.inputs[0].default_value = (.13, .22, .24, 1)
background.inputs[1].default_value = .35
camera_data = bpy.data.cameras.new('review-camera')
camera = bpy.data.objects.new('review-camera', camera_data)
bpy.context.collection.objects.link(camera)
camera.location = P((1.9, 1.1, 5.8) if options.view == 'three-quarter' else (0, .5, 6))
aim(camera, (-.24, .12, 0))
camera_data.type, camera_data.ortho_scale = 'ORTHO', 2.95
scene.camera = camera
if options.lighting == 'studio':
    area('large-soft-key', (1, 4, 5), 450, 4, (1, .87, .73))
    area('cool-rim', (-3, 2, -3), 500, 3, (.55, .82, 1))
    area('face-fill', (4, .5, 1), 70, 2, (1, .93, .85))
else:
    area('raking-key', (-4, 2, 2), 350, 2, (.74, .88, 1))
    area('warm-edge', (3, 1, -3), 300, 2, (1, .68, .43))
    area('quiet-fill', (3, 1, 5), 35, 3, (1, .93, .85))
# Authoring render at the baby's actual runtime rest orientation/stage.
for name in ('pectoral-fin', 'tail', 'mouth'):
    bpy.data.objects[name].rotation_mode = 'XYZ'
# App +Z maps to Blender -Y, while app +Y maps to Blender +Z.
bpy.data.objects['pectoral-fin'].rotation_euler.y = -options.fin_angle
bpy.data.objects['tail'].rotation_euler.z = options.tail_angle
bpy.data.objects['mouth'].scale.z = options.mouth_scale
bpy.data.objects['growth-markings'].hide_render = options.stage < 2
bpy.data.objects['growth-fin-detail'].hide_render = options.stage < 3
scene.view_settings.view_transform = 'AgX'
scene.render.filepath = str(options.output.resolve())
bpy.ops.render.render(write_still=True)
