"""Render an isolated, labeled inventory from actual GLB bytes (no asset mutation).

All nine parts use fixed baseline-derived display scales and matching light/camera
settings; these presentation transforms are never exported to the game library.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
IDS = ['puppy-ball', 'soft-bed', 'puppy-house', 'flower-hoop', 'water-bowl',
       'paw-flag', 'feeding-bowl', 'grooming-brush', 'dog-food']
LABELS = ['PLAY BALL', 'SOFT BED', 'PUPPY HOUSE', 'FLOWER HOOP', 'WATER BOWL',
          'PAW FLAG', 'FEEDING BOWL', 'GROOMING BRUSH', 'KIBBLE']


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def mat(name, color, roughness=1):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    node = material.node_tree.nodes['Principled BSDF']
    node.inputs['Base Color'].default_value = color
    node.inputs['Roughness'].default_value = roughness
    return material


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--size', type=int, default=1200)
    parser.add_argument('--part', choices=IDS)
    parser.add_argument('--samples', type=int, default=32)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(args.source.resolve()))
    baseline = json.loads((HERE / 'baseline-bounds.json').read_text())['bounds']
    plate = mat('Review plinth only', (.72, .77, .69, 1))
    ink = mat('Review caption only', (.055, .09, .07, 1))
    selected = [args.part] if args.part else IDS
    # A focused view must not leave the other imported parts stacked at origin.
    for part_id in set(IDS) - set(selected):
        for child in [bpy.data.objects[part_id], *bpy.data.objects[part_id].children_recursive]:
            child.hide_render = True
    for i, part_id in enumerate(selected):
        column, row = i % 3, i // 3
        x,z=(0,0) if args.part else ((column-1)*2.45,(2-row)*2.50)
        wrapper = bpy.data.objects.new(f'review-{part_id}', None)
        bpy.context.collection.objects.link(wrapper)
        wrapper.location = (x, 0, z)
        wrapper.rotation_euler.z = -.32
        part = bpy.data.objects[part_id]
        part.parent = wrapper
        part.rotation_mode = 'XYZ'
        if part_id == 'grooming-brush':
            part.rotation_euler.x = math.pi
        scale = 1.45 / max(baseline[part_id]['size'])
        part.scale = (scale, scale, scale)
        bpy.context.view_layer.update()
        # Compute display centering after fixed orientation. Runtime origins stay
        # untouched inside the source GLB; this transform is presentation-only.
        points = [wrapper.matrix_world.inverted() @ child.matrix_world @ vertex.co
                  for child in part.children_recursive if child.type == 'MESH'
                  for vertex in child.data.vertices]
        center_x = (min(p.x for p in points) + max(p.x for p in points)) / 2
        center_y = (min(p.y for p in points) + max(p.y for p in points)) / 2
        part.location = (-center_x, -center_y, .065 - min(p.z for p in points))
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0, z - .02))
        plinth = bpy.context.object
        plinth.name = f'review-plinth-{i}'
        plinth.dimensions = (2.08, 1.55, .10)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        mod = plinth.modifiers.new('Soft review plinth edge', 'BEVEL')
        mod.width, mod.segments = .04, 3
        plinth.data.materials.append(plate)
        text = bpy.data.curves.new(f'review-label-{i}', 'FONT')
        text.body, text.align_x, text.size = LABELS[IDS.index(part_id)], 'CENTER', .135
        label = bpy.data.objects.new(f'review-label-{i}', text)
        bpy.context.collection.objects.link(label)
        label.location = (x, -.92, z - .245)
        label.rotation_euler.x = math.pi / 2
        label.data.materials.append(ink)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = False
    scene.render.resolution_x = args.size
    scene.render.resolution_y = args.size
    scene.render.resolution_percentage = 100
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes['Background']
    background.inputs['Color'].default_value = (.72, .76, .68, 1)
    background.inputs['Strength'].default_value = .65
    for name, location, energy, size, color in [
        ('Review key', (-3, -5, 9), 850, 6, (1, .92, .81)),
        ('Review fill', (4, -3, 6), 650, 7, (.82, .92, 1)),
        ('Review rim', (1, 5, 9), 950, 6, (1, .98, .89)),
    ]:
        light = bpy.data.lights.new(name, 'AREA')
        light.energy, light.size, light.color = energy, size, color
        obj = bpy.data.objects.new(name, light)
        bpy.context.collection.objects.link(obj)
        obj.location = location
        aim(obj, (0, 0, 2.4))
    camera = bpy.data.cameras.new('Review camera')
    obj = bpy.data.objects.new('Review camera', camera)
    bpy.context.collection.objects.link(obj)
    obj.location = (0,-5,3.275) if args.part else (0,-14,10.35)
    aim(obj,(0,0,.65) if args.part else (0,0,3.0))
    camera.type,camera.ortho_scale='ORTHO',2.35 if args.part else 8.2
    scene.camera = obj
    scene.view_settings.view_transform = 'AgX'
    scene.render.image_settings.file_format = 'PNG'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(args.output.resolve())
    bpy.ops.render.render(write_still=True)
    assert args.output.is_file()


if __name__ == '__main__':
    main()
